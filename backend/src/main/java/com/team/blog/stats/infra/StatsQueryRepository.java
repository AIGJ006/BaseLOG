package com.team.blog.stats.infra;

import com.team.blog.post.infra.SqlCondition;
import com.team.blog.post.infra.VisibilityFilter;
import com.team.blog.shared.security.Viewer;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 관리자 통계의 회원·글·댓글 수와 조회수 (024). <b>원칙 II 읽기 예외</b>({@link com.team.blog.stats}): 여러 모듈 테이블의 합계만 읽기
 * 전용으로 센다. 누가 썼는지·누가 봤는지는 돌려주지 않는다.
 */
@Repository
public class StatsQueryRepository {

    /** 전체 수와 기준 시각 이후 수. */
    public record Counts(long total, long today, long last7Days) {}

    /** 많이 본 글 한 줄. */
    public record TopPostRow(long postId, String title, String handle, long views) {}

    private final JdbcClient jdbc;
    private final VisibilityFilter visibilityFilter;

    public StatsQueryRepository(JdbcClient jdbc, VisibilityFilter visibilityFilter) {
        this.jdbc = jdbc;
        this.visibilityFilter = visibilityFilter;
    }

    /** 가입 회원 수(탈퇴 제외). 오늘·최근 7일은 가입 시각 기준. */
    public Counts members(OffsetDateTime todayStart, OffsetDateTime weekStart) {
        return counts(
                """
                SELECT count(*),
                       count(*) FILTER (WHERE created_at >= :today),
                       count(*) FILTER (WHERE created_at >= :week)
                FROM member WHERE status <> 'WITHDRAWN'
                """,
                todayStart,
                weekStart);
    }

    /** 등록한 글 수(지운 글·숨긴 글 제외, 공개 범위 무관). 오늘·최근 7일은 처음 등록한 시각 기준. */
    public Counts posts(OffsetDateTime todayStart, OffsetDateTime weekStart) {
        return counts(
                """
                SELECT count(*),
                       count(*) FILTER (WHERE published_at >= :today),
                       count(*) FILTER (WHERE published_at >= :week)
                FROM post
                WHERE status = 'PUBLISHED' AND deleted_at IS NULL AND hidden_at IS NULL
                """,
                todayStart,
                weekStart);
    }

    /** 댓글 수(지운 댓글·숨긴 댓글 제외). */
    public Counts comments(OffsetDateTime todayStart, OffsetDateTime weekStart) {
        return counts(
                """
                SELECT count(*),
                       count(*) FILTER (WHERE created_at >= :today),
                       count(*) FILTER (WHERE created_at >= :week)
                FROM comment WHERE deleted_at IS NULL AND hidden_at IS NULL
                """,
                todayStart,
                weekStart);
    }

    private Counts counts(String sql, OffsetDateTime todayStart, OffsetDateTime weekStart) {
        return jdbc.sql(sql)
                .param("today", todayStart)
                .param("week", weekStart)
                .query((rs, i) -> new Counts(rs.getLong(1), rs.getLong(2), rs.getLong(3)))
                .single();
    }

    /** 날짜별 글 조회수 합계({@code post_view_daily}). 없는 날은 빠진다. */
    public Map<LocalDate, Long> dailyViews(LocalDate from, LocalDate to) {
        Map<LocalDate, Long> out = new LinkedHashMap<>();
        jdbc.sql(
                        """
                        SELECT view_date, SUM(views) FROM post_view_daily
                        WHERE view_date BETWEEN :from AND :to GROUP BY view_date
                        """)
                .param("from", from)
                .param("to", to)
                .query(
                        rs -> {
                            out.put(rs.getObject(1, LocalDate.class), rs.getLong(2));
                        });
        return out;
    }

    /** 누적 글 조회수({@code post.view_count} 합계, 지운 글 제외). */
    public long totalViews() {
        return jdbc.sql("SELECT COALESCE(SUM(view_count), 0) FROM post WHERE deleted_at IS NULL")
                .query(Long.class)
                .single();
    }

    /**
     * {@code from} 이후 조회수가 많은 글. 비회원이 홈에서 볼 수 있는 글만(004 {@link VisibilityFilter} 공용 조건) — 친구 공개·비공개
     * 글은 제목이 드러나지 않게 뺀다.
     *
     * @param limit 최대 개수
     */
    public List<TopPostRow> topPosts(LocalDate from, int limit) {
        SqlCondition visibility = visibilityFilter.forViewer(Viewer.anonymous(), null);
        Map<String, Object> params = new LinkedHashMap<>(visibility.params());
        params.put("from", from);
        params.put("limit", limit);
        String sql =
                """
                SELECT p.id, p.title, m.handle, SUM(d.views) AS views
                FROM post_view_daily d
                JOIN post p ON p.id = d.post_id
                JOIN member m ON m.id = p.author_id
                WHERE d.view_date >= :from AND %s
                GROUP BY p.id, p.title, m.handle
                ORDER BY views DESC, p.id DESC
                LIMIT :limit
                """
                        .formatted(visibility.sql());
        return jdbc.sql(sql)
                .params(params)
                .query(
                        (rs, i) ->
                                new TopPostRow(
                                        rs.getLong("id"),
                                        rs.getString("title"),
                                        rs.getString("handle"),
                                        rs.getLong("views")))
                .list();
    }
}
