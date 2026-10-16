package com.team.blog.post.infra;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 공동 작업자 (030, V22 {@code post_collaborator}). 공동 작업자는 지금도 글쓴이와 수락된 친구이고 탈퇴하지 않은 회원만 센다 — 친구를 끊을 때
 * 행을 지우지만({@link #deleteBetween}) 권한 확인과 목록도 친구 관계를 함께 본다.
 */
@Repository
public class PostCollaboratorRepository {

    /** {@code p}(글)의 글쓴이와 {@code c.member_id}가 지금 친구인가. */
    private static final String STILL_FRIENDS =
            """
            EXISTS (SELECT 1 FROM friendship f
                     WHERE f.member_a_id = LEAST(p.author_id, c.member_id)
                       AND f.member_b_id = GREATEST(p.author_id, c.member_id)
                       AND f.status = 'ACCEPTED')
            """;

    private final JdbcClient jdbc;

    public PostCollaboratorRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 화면에 보일 공동 작업자 한 명. */
    public record Row(long memberId, String handle, String nickname, String profileKey) {}

    /** 고칠 수 있는 글의 글쓴이. 내 글(휴지통 아님)이면 나, 남의 발행 글이면 내가 지금 그 글의 공동 작업자일 때만 그 글쓴이. 그 밖은 빈 값. */
    public Optional<Long> findEditableAuthor(long postId, long memberId) {
        return jdbc.sql(
                        "SELECT p.author_id FROM post p WHERE p.id = :id AND p.deleted_at IS NULL"
                                + " AND (p.author_id = :me OR (p.status = 'PUBLISHED' AND EXISTS ("
                                + " SELECT 1 FROM post_collaborator c JOIN member cm ON cm.id = c.member_id"
                                + " WHERE c.post_id = p.id AND c.member_id = :me"
                                + " AND cm.status <> 'WITHDRAWN' AND cm.deleted_at IS NULL AND "
                                + STILL_FRIENDS
                                + ")))")
                .param("id", postId)
                .param("me", memberId)
                .query(Long.class)
                .optional();
    }

    /** 글의 공동 작업자 (고른 순서). 친구가 아니게 됐거나 탈퇴한 회원은 뺀다. */
    public List<Row> findCollaborators(long postId) {
        return jdbc.sql(
                        "SELECT m.id, m.handle, m.nickname,"
                                + " COALESCE(pi.thumb_storage_key, pi.storage_key) AS profile_key"
                                + " FROM post p JOIN post_collaborator c ON c.post_id = p.id"
                                + " JOIN member m ON m.id = c.member_id"
                                + " LEFT JOIN image pi ON pi.uploader_id = m.id AND pi.purpose = 'PROFILE'"
                                + " AND pi.status = 'ATTACHED' AND pi.detached_at IS NULL"
                                + " WHERE p.id = :id AND m.status <> 'WITHDRAWN' AND m.deleted_at IS NULL"
                                + " AND "
                                + STILL_FRIENDS
                                + " ORDER BY c.created_at, m.id")
                .param("id", postId)
                .query(
                        (rs, n) ->
                                new Row(
                                        rs.getLong("id"),
                                        rs.getString("handle"),
                                        rs.getString("nickname"),
                                        rs.getString("profile_key")))
                .list();
    }

    /**
     * 두 회원이 수락된 친구인지 보고, 그 친구 행을 트랜잭션 끝까지 잠근다({@code FOR SHARE}). 공동 작업자를 더하는 동안 친구 끊기가 끼어들어 정리 뒤에
     * 행이 남는 일을 막는다 — 끊기가 먼저면 여기서 친구가 아님, 여기가 먼저면 끊기가 기다렸다가 새 행까지 지운다.
     */
    public boolean lockAcceptedFriendship(long memberId, long otherMemberId) {
        return jdbc.sql(
                        "SELECT 1 FROM friendship WHERE member_a_id = LEAST(:a, :b)"
                                + " AND member_b_id = GREATEST(:a, :b) AND status = 'ACCEPTED'"
                                + " FOR SHARE")
                .param("a", memberId)
                .param("b", otherMemberId)
                .query(Integer.class)
                .optional()
                .isPresent();
    }

    /** 저장된 공동 작업자 번호 (친구 여부와 상관없이 행 그대로). */
    public List<Long> findMemberIds(long postId) {
        return jdbc.sql("SELECT member_id FROM post_collaborator WHERE post_id = ?")
                .param(postId)
                .query(Long.class)
                .list();
    }

    /** 주소({@code handle})로 탈퇴하지 않은 회원 번호를 찾는다. 없는 주소는 빠진다. */
    public List<HandleId> findMemberIdsByHandles(Collection<String> handles) {
        if (handles.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(
                        "SELECT id, handle FROM member WHERE handle IN (:handles)"
                                + " AND status <> 'WITHDRAWN' AND deleted_at IS NULL")
                .param("handles", handles)
                .query((rs, n) -> new HandleId(rs.getString("handle"), rs.getLong("id")))
                .list();
    }

    public record HandleId(String handle, long memberId) {}

    /** 더한다. 이미 있으면 그대로. 새로 넣었으면 {@code true}. */
    public boolean insert(long postId, long memberId) {
        return jdbc.sql(
                                "INSERT INTO post_collaborator (post_id, member_id) VALUES (?, ?)"
                                        + " ON CONFLICT DO NOTHING")
                        .param(postId)
                        .param(memberId)
                        .update()
                > 0;
    }

    public int delete(long postId, long memberId) {
        return jdbc.sql("DELETE FROM post_collaborator WHERE post_id = ? AND member_id = ?")
                .param(postId)
                .param(memberId)
                .update();
    }

    /** 두 회원 사이의 공동 작업 관계를 모두 지운다 (친구 끊기). 서로의 글 모두. */
    public int deleteBetween(long memberId, long otherMemberId) {
        return jdbc.sql(
                        "DELETE FROM post_collaborator c USING post p WHERE p.id = c.post_id AND ("
                                + "(p.author_id = :a AND c.member_id = :b)"
                                + " OR (p.author_id = :b AND c.member_id = :a))")
                .param("a", memberId)
                .param("b", otherMemberId)
                .update();
    }
}
