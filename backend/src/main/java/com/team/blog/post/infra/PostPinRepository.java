package com.team.blog.post.infra;

import com.team.blog.post.domain.PostStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * 고정 글 (029). {@code post.pinned_at}만 읽고 쓴다. 잠금 조회는 호출한 쪽 트랜잭션 안에서 불러야 한다.
 *
 * <p>한 둥지 최대 개수를 지키려고 고정 전에 {@link #lockAuthor}로 그 회원의 고정 처리를 한 번에 하나씩 돌린다 — 서로 다른 두 글을 동시에 고정해도 개수
 * 확인이 겹치지 않는다(트랜잭션이 끝나면 풀린다).
 */
@Repository
public class PostPinRepository {

    /** advisory lock 첫 번째 키 (029 고정 글). 둘째 키는 회원 번호. */
    private static final int LOCK_SPACE = 29;

    private static final RowMapper<PinTarget> ROW =
            (rs, n) ->
                    new PinTarget(
                            rs.getLong("id"),
                            PostStatus.valueOf(rs.getString("status")),
                            instant(rs, "pinned_at"));

    private final NamedParameterJdbcTemplate jdbc;

    public PostPinRepository(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 그 회원의 고정 처리를 트랜잭션 끝까지 한 번에 하나로 묶는다. */
    public void lockAuthor(long authorId) {
        jdbc.query(
                "SELECT pg_advisory_xact_lock(:space, CAST(:key AS integer))",
                Map.of("space", LOCK_SPACE, "key", authorId % Integer.MAX_VALUE),
                rs -> null);
    }

    /** 내 휴지통 밖 글을 잠근다. 남의 글·없는 글·휴지통 글은 빈 값 — 호출한 쪽이 같은 404로 응답한다. */
    public Optional<PinTarget> lockOwned(long postId, long me) {
        return jdbc
                .query(
                        "SELECT id, status, pinned_at FROM post"
                                + " WHERE id = :postId AND author_id = :me AND deleted_at IS NULL"
                                + " FOR UPDATE",
                        Map.of("postId", postId, "me", me),
                        ROW)
                .stream()
                .findFirst();
    }

    /** 그 회원의 고정 글 수 (등록·휴지통 밖만). */
    public int countPinned(long authorId) {
        Integer n =
                jdbc.queryForObject(
                        "SELECT count(*) FROM post WHERE author_id = :me AND pinned_at IS NOT NULL"
                                + " AND status = 'PUBLISHED' AND deleted_at IS NULL",
                        Map.of("me", authorId),
                        Integer.class);
        return n == null ? 0 : n;
    }

    /** 고정 시각을 쓴다 ({@code null}이면 고정 해제). {@code updated_at}은 그대로 둔다. */
    public void setPinnedAt(long postId, Instant pinnedAt) {
        Map<String, Object> params = new HashMap<>();
        params.put("id", postId);
        params.put(
                "at",
                pinnedAt == null
                        ? null
                        : pinnedAt.truncatedTo(ChronoUnit.MICROS).atOffset(ZoneOffset.UTC));
        jdbc.update("UPDATE post SET pinned_at = CAST(:at AS timestamptz) WHERE id = :id", params);
    }

    /**
     * 고정 대상 글.
     *
     * @param id 글 번호
     * @param status 글 상태 (등록 글만 고정할 수 있다)
     * @param pinnedAt 고정 시각 (없으면 {@code null})
     */
    public record PinTarget(long id, PostStatus status, Instant pinnedAt) {}

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        OffsetDateTime value = rs.getObject(column, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }
}
