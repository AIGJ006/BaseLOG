package com.team.blog.discovery.infra;

import com.team.blog.discovery.application.CardFilter;
import com.team.blog.discovery.application.PostListCursor.CursorKey;
import com.team.blog.post.infra.SqlCondition;
import com.team.blog.post.infra.VisibilityFilter;
import com.team.blog.shared.security.Viewer;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 홈·블로그 글 카드 조회 (005 T010, 10 §7, C-READ-1 #6, research R-06·R-07). 글 + 작성자 + 프로필 사진을 <b>SQL 한
 * 번</b>으로 읽고 본문 컬럼({@code content_md}·{@code content_html})은 읽지 않는다.
 *
 * <ul>
 *   <li>노출 조건은 004 {@link VisibilityFilter#forViewer(Viewer, Long)}의 조각 하나만 쓴다(별칭 {@code p}·{@code
 *       m} 계약) — 부분 인덱스 {@code ix_post_feed}·{@code ix_post_blog}의 술어가 그대로 들어간다. 작성자 본인 예외 없음(06
 *       V-8).
 *   <li>프로필 사진 JOIN 조건은 {@code uq_image_profile_current}의 술어와 같다(회원당 최대 1행).
 *   <li>커서는 행 값 비교 {@code (p.first_public_at, p.id) < (:cursorAt, :cursorId)} — 같은 마이크로초 글도 빠지지
 *       않는다. 주인·친구가 보는 블로그 목록({@code VisibilityFilter#forFriendBlog})과 친구 피드({@code
 *       VisibilityFilter#forFriendFeed})는 {@code COALESCE(p.first_public_at,
 *       p.published_at)}이다(FR-048).
 * </ul>
 *
 * <p>member·image JOIN은 plan Complexity Tracking의 원칙 II 예외이므로 discovery 모듈에서 그 테이블을 읽는 곳은 이 클래스뿐이다.
 * 008 태그별 목록·블로그 태그 필터의 {@code post_tag} 조건({@code EXISTS}, {@link CardFilter#tagId()})도 같은 예외다(008
 * plan Complexity Tracking) — 카드 SQL 한 번에 커서·정렬을 그대로 쓰려고 같은 문장 안에 둔다. 친구 피드(020)의 {@code
 * friendship} 조건({@code EXISTS}, {@link CardFilter#friendOf()} — PK {@code (member_a_id,
 * member_b_id)})도 같은 예외다(옛 010 팔로우 피드 자리).
 */
@Repository
public class PostCardQueryRepository {

    private static final String SELECT = select("p.first_public_at");

    /**
     * 친구 피드와 주인·친구가 보는 블로그 목록 (FR-048): 친구 공개 글은 최초 공개 일자가 없으므로 정렬·커서·카드 날짜를 최초 공개 일자, 없으면 최초 발행
     * 일자로 읽는다(열 이름은 같게 {@code first_public_at}으로 둔다). 전체 공개 글은 홈·남이 보는 블로그와 같은 자리에 온다.
     */
    private static final String LISTED_AT_WITH_FRIENDS =
            "COALESCE(p.first_public_at, p.published_at)";

    private static final String SELECT_WITH_FRIENDS =
            select(LISTED_AT_WITH_FRIENDS + " AS first_public_at");

    private static String select(String listedAt) {
        return """
            SELECT p.id, p.title, p.excerpt, p.thumbnail_url, %s,
                   p.comment_count, p.like_count, p.visibility, m.handle, m.nickname,
                   (p.pinned_at IS NOT NULL) AS pinned,
                   EXISTS (SELECT 1 FROM post_collaborator pc JOIN member pcm ON pcm.id = pc.member_id
                            WHERE pc.post_id = p.id
                              AND pcm.status <> 'WITHDRAWN' AND pcm.deleted_at IS NULL
                              AND %s) AS collaborative,
                   COALESCE(pi.thumb_storage_key, pi.storage_key) AS profile_key
              FROM post p
              JOIN member m ON m.id = p.author_id
              LEFT JOIN image pi ON pi.uploader_id = m.id AND pi.purpose = 'PROFILE'
                   AND pi.status = 'ATTACHED' AND pi.detached_at IS NULL
             WHERE\s"""
                .formatted(listedAt, stillFriends("pc.member_id"));
    }

    /**
     * 030: 글쓴이({@code p.author_id})와 {@code member}가 지금 수락된 친구인가. 공동 작업자는 친구가 끊기면 빠지므로(행을 지우지만) 카드
     * 표시·목록도 친구 관계를 함께 본다({@code PostCollaboratorRepository}와 같은 규칙).
     */
    private static String stillFriends(String member) {
        return ("EXISTS (SELECT 1 FROM friendship cf WHERE cf.member_a_id = LEAST(p.author_id, %1$s)"
                        + " AND cf.member_b_id = GREATEST(p.author_id, %1$s) AND cf.status = 'ACCEPTED')")
                .formatted(member);
    }

    /**
     * 030: 이 회원이 공동 작업자인 글 번호 (공동 작업자가 지금도 글쓴이와 친구이고 탈퇴하지 않았을 때만). 둥지 첫 목록에서 주인 글 조건을 "주인 글이거나 이 번호
     * 중 하나"로 넓힐 때 쓴다. 번호를 먼저 따로 읽어 두는 건 목록 문장이 블로그 인덱스(ix_post_blog·ix_post_blog_friends)를 그대로 타게
     * 하려는 것 — 공동 작업 글이 없는 대부분의 둥지는 목록 문장이 예전과 같다.
     */
    private static final String COLLABORATED_POST_IDS =
            """
            SELECT c.post_id FROM post_collaborator c
              JOIN post cp ON cp.id = c.post_id
              JOIN member cm ON cm.id = c.member_id
             WHERE c.member_id = :memberId
               AND cm.status <> 'WITHDRAWN' AND cm.deleted_at IS NULL
               AND EXISTS (SELECT 1 FROM friendship cf
                            WHERE cf.member_a_id = LEAST(cp.author_id, c.member_id)
                              AND cf.member_b_id = GREATEST(cp.author_id, c.member_id)
                              AND cf.status = 'ACCEPTED')
            """;

    /** 둥지 주인 글 조건 대신 "주인이 공동 작업자인 남의 글". 공개 범위·숨김·휴지통 조건은 그대로라 원래 공개 범위보다 넓게 보이지 않는다. */
    private static final String COLLABORATED_ONLY =
            "p.id = ANY(:collaboratedIds) AND p.author_id <> :authorId";

    private static final String AUTHOR_ONLY = "p.author_id = :authorId";

    private final JdbcClient jdbc;
    private final VisibilityFilter visibilityFilter;

    public PostCardQueryRepository(JdbcClient jdbc, VisibilityFilter visibilityFilter) {
        this.jdbc = jdbc;
        this.visibilityFilter = visibilityFilter;
    }

    /**
     * @param viewer 보는 사람 (공통 규칙에서는 결과에 영향 없음)
     * @param filter 블로그 주인·태그 조건 (전체 목록이면 {@link CardFilter#all()})
     * @param after 이 위치보다 이전 글만 (첫 페이지면 {@code null})
     * @param limit 읽을 행 수 (보통 page-size + 1)
     */
    public List<PostCardRow> findCards(
            Viewer viewer, CardFilter filter, CursorKey after, int limit) {
        CardQuery query = cardQuery(viewer, filter, after, limit);
        return jdbc.sql(query.sql())
                .params(query.params())
                .query(PostCardQueryRepository::toRow)
                .list();
    }

    /**
     * 번호로 카드 읽기 (012 T005, research R2·R5·R8). 홈과 같은 SELECT + 비회원 기준 공용 조건({@link
     * VisibilityFilter#forViewer}) + {@code p.id = ANY(:ids)} — 트렌딩 스냅샷·검색 결과의 글 중 <b>지금</b> 볼 수 있는
     * 것만 돌려준다(FR-012). 순서는 보장하지 않으므로 부른 쪽이 번호 순서대로 맞춘다. 빈 목록이면 SQL 없이 빈 목록.
     */
    public List<PostCardRow> findCardsByIds(List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        SqlCondition condition = visibilityFilter.forViewer(Viewer.anonymous(), null);
        Map<String, Object> params = new LinkedHashMap<>(condition.params());
        params.put("ids", ids.toArray(Long[]::new));
        return jdbc.sql(SELECT + condition.sql() + " AND p.id = ANY(:ids)")
                .params(params)
                .query(PostCardQueryRepository::toRow)
                .list();
    }

    /**
     * {@link #findCards}가 실행하는 SQL과 매개변수 (005 T072 — 인덱스 사용을 {@code EXPLAIN}으로 확인할 때 같은 문장을 쓴다).
     */
    public CardQuery cardQuery(Viewer viewer, CardFilter filter, CursorKey after, int limit) {
        // 친구 피드, 주인·친구가 보는 블로그면 친구 공개 글도 넣는다 (FR-048). 홈·태그는 전체 공개 글만
        boolean friendFeed = filter.friendOf() != null;
        boolean friendBlog =
                !friendFeed
                        && filter.authorId() != null
                        && visibilityFilter.seesFriendsPosts(viewer, filter.authorId());
        SqlCondition condition =
                friendFeed
                        ? visibilityFilter.forFriendFeed(filter.authorId())
                        : friendBlog
                                ? visibilityFilter.forFriendBlog(viewer, filter.authorId())
                                : visibilityFilter.forViewer(viewer, filter.authorId());
        boolean withFriends = friendFeed || friendBlog;
        String sortColumn = withFriends ? LISTED_AT_WITH_FRIENDS : "p.first_public_at";
        // 030: 둥지 첫 목록(태그·카테고리·고정 칸 아님)에는 이 회원이 공동 작업자인 글도 함께 — 카드의 공동 작업 표시로 구분한다
        boolean withCollaborations =
                !friendFeed
                        && filter.authorId() != null
                        && filter.tagId() == null
                        && filter.categoryIds() == null
                        && filter.pins() != CardFilter.Pins.ONLY;
        Map<String, Object> params = new LinkedHashMap<>(condition.params());
        String where = condition.sql();
        List<Long> collaborated =
                withCollaborations
                        ? jdbc.sql(COLLABORATED_POST_IDS)
                                .param("memberId", filter.authorId())
                                .query(Long.class)
                                .list()
                        : List.of();
        if (!collaborated.isEmpty()) {
            if (!where.contains(AUTHOR_ONLY)) {
                throw new IllegalStateException("둥지 목록 조건에 글쓴이 조건이 없다: " + where);
            }
            params.put("collaboratedIds", collaborated.toArray(Long[]::new));
        }
        String select = withFriends ? SELECT_WITH_FRIENDS : SELECT;
        StringBuilder sql = new StringBuilder(select).append(where);
        if (filter.tagId() != null) {
            sql.append(
                    " AND EXISTS (SELECT 1 FROM post_tag pt WHERE pt.post_id = p.id"
                            + " AND pt.tag_id = :tagId)");
            params.put("tagId", filter.tagId());
        }
        if (filter.friendOf() != null) {
            // 020 친구 피드: friendship은 (작은 번호, 큰 번호) 한 행이라 PK로 바로 찾는다
            // 030: 친구가 공동 작업자인 남의 전체 공개 글도 (친구 공개 글은 글쓴이의 친구에게만 — 원래 공개 범위 그대로)
            sql.append(
                    " AND (EXISTS (SELECT 1 FROM friendship fr"
                            + " WHERE fr.member_a_id = LEAST(:friendOf, p.author_id)"
                            + " AND fr.member_b_id = GREATEST(:friendOf, p.author_id)"
                            + " AND fr.status = 'ACCEPTED')"
                            + " OR ("
                            + VisibilityFilter.PUBLIC_ONLY
                            + " AND p.author_id <> :friendOf"
                            + " AND EXISTS (SELECT 1 FROM post_collaborator c"
                            + " JOIN member cm ON cm.id = c.member_id WHERE c.post_id = p.id"
                            + " AND cm.status <> 'WITHDRAWN' AND cm.deleted_at IS NULL"
                            + " AND EXISTS (SELECT 1 FROM friendship mf"
                            + " WHERE mf.member_a_id = LEAST(:friendOf, c.member_id)"
                            + " AND mf.member_b_id = GREATEST(:friendOf, c.member_id)"
                            + " AND mf.status = 'ACCEPTED') AND "
                            + stillFriends("c.member_id")
                            + ")))");
            params.put("friendOf", filter.friendOf());
        }
        if (filter.categoryIds() != null) {
            // 017 카테고리 필터: 번호 목록은 category 모듈이 준다(이 클래스는 category를 읽지 않음)
            sql.append(" AND p.category_id IN (:categoryIds)");
            params.put("categoryIds", filter.categoryIds());
        }
        if (filter.pins() == CardFilter.Pins.ONLY) {
            // 029 고정 글: 최근 고정한 순, 한 둥지 최대 3개라 커서 없이 한 번에 읽는다
            sql.append(
                    " AND p.pinned_at IS NOT NULL ORDER BY p.pinned_at DESC, p.id DESC LIMIT :limit");
            params.put("limit", limit);
            return new CardQuery(sql.toString(), params);
        }
        if (filter.pins() == CardFilter.Pins.EXCLUDE) {
            // 고정 칸에 따로 나오는 건 이 둥지 주인의 고정 글뿐 — 남이 고정한 공동 작업 글은 아래 공동 작업 쪽에 그대로 둔다
            sql.append(" AND p.pinned_at IS NULL");
        }
        String cursor = "";
        if (after != null) {
            cursor = " AND (" + sortColumn + ", p.id) < (:cursorAt, :cursorId)";
            params.put("cursorAt", after.firstPublicAt().withOffsetSameInstant(ZoneOffset.UTC));
            params.put("cursorId", after.id());
        }
        String order = " ORDER BY " + sortColumn + " DESC, p.id DESC LIMIT :limit";
        sql.append(cursor).append(order);
        params.put("limit", limit);
        if (!collaborated.isEmpty()) {
            // 030: 주인 글(블로그 인덱스로 정렬된 채 읽음)과 공동 작업 글(번호로 읽음)을 따로 읽어 합친 뒤 다시 정렬한다
            String theirs = select + where.replace(AUTHOR_ONLY, COLLABORATED_ONLY) + cursor + order;
            return new CardQuery(
                    "SELECT * FROM (("
                            + sql
                            + ") UNION ALL ("
                            + theirs
                            + ")) cards"
                            + " ORDER BY first_public_at DESC, id DESC LIMIT :limit",
                    params);
        }
        return new CardQuery(sql.toString(), params);
    }

    /**
     * 카드 조회 문장.
     *
     * @param sql 이름 붙은 매개변수({@code :name})를 쓴 SQL
     * @param params 매개변수 값
     */
    public record CardQuery(String sql, Map<String, Object> params) {}

    private static PostCardRow toRow(ResultSet rs, int rowNum) throws SQLException {
        OffsetDateTime at = rs.getObject("first_public_at", OffsetDateTime.class);
        return new PostCardRow(
                rs.getLong("id"),
                rs.getString("title"),
                rs.getString("excerpt"),
                rs.getString("thumbnail_url"),
                at == null ? null : at.withOffsetSameInstant(ZoneOffset.UTC),
                rs.getInt("comment_count"),
                rs.getInt("like_count"),
                rs.getString("visibility"),
                rs.getString("handle"),
                rs.getString("nickname"),
                rs.getString("profile_key"),
                rs.getBoolean("pinned"),
                rs.getBoolean("collaborative"));
    }
}
