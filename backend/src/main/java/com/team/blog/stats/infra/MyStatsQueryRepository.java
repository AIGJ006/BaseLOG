package com.team.blog.stats.infra;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 내 둥지 통계의 숫자 (2026-10-15). <b>원칙 II 읽기 예외</b>({@link com.team.blog.stats}): 한 회원의 글·좋아요·댓글·일별 조회수
 * 합계만 읽기 전용으로 센다. 누가 봤는지·누가 눌렀는지는 돌려주지 않는다. 지운 글은 빼고, 좋아요·댓글은 본인 것을 뺀다.
 */
@Repository
public class MyStatsQueryRepository {

    /** 전체 수와 기준 시각 이후 수. */
    public record Counts(long total, long today, long last7Days) {}

    /** 많이 본 글 한 줄. */
    public record TopPostRow(long postId, String title, String visibility, long views) {}

    /** 하루 수. */
    public record DayRow(LocalDate date, long likes, long comments) {}

    private static final String MY_POST = "p.author_id = :me AND p.deleted_at IS NULL";

    private final JdbcClient jdbc;

    public MyStatsQueryRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 등록한 글 수(숨긴 글 제외, 공개 범위 무관). 오늘·최근 7일은 처음 등록한 시각 기준. */
    public Counts posts(long me, OffsetDateTime todayStart, OffsetDateTime weekStart) {
        return counts(
                """
                SELECT count(*),
                       count(*) FILTER (WHERE p.published_at >= :today),
                       count(*) FILTER (WHERE p.published_at >= :week)
                FROM post p
                WHERE %s AND p.status = 'PUBLISHED' AND p.hidden_at IS NULL
                """
                        .formatted(MY_POST),
                me,
                todayStart,
                weekStart);
    }

    /** 내 글이 받은 좋아요(내가 누른 것 제외). */
    public Counts likes(long me, OffsetDateTime todayStart, OffsetDateTime weekStart) {
        return counts(
                """
                SELECT count(*),
                       count(*) FILTER (WHERE l.created_at >= :today),
                       count(*) FILTER (WHERE l.created_at >= :week)
                FROM post_like l JOIN post p ON p.id = l.post_id
                WHERE %s AND l.member_id <> :me
                """
                        .formatted(MY_POST),
                me,
                todayStart,
                weekStart);
    }

    /** 내 글에 달린 댓글(내가 쓴 것·지운 것·숨긴 것 제외, 대댓글 포함). */
    public Counts comments(long me, OffsetDateTime todayStart, OffsetDateTime weekStart) {
        return counts(
                """
                SELECT count(*),
                       count(*) FILTER (WHERE c.created_at >= :today),
                       count(*) FILTER (WHERE c.created_at >= :week)
                FROM comment c JOIN post p ON p.id = c.post_id
                WHERE %s AND c.author_id <> :me AND c.deleted_at IS NULL AND c.hidden_at IS NULL
                """
                        .formatted(MY_POST),
                me,
                todayStart,
                weekStart);
    }

    private Counts counts(
            String sql, long me, OffsetDateTime todayStart, OffsetDateTime weekStart) {
        return jdbc.sql(sql)
                .param("me", me)
                .param("today", todayStart)
                .param("week", weekStart)
                .query((rs, i) -> new Counts(rs.getLong(1), rs.getLong(2), rs.getLong(3)))
                .single();
    }

    /** 날짜별 내 글 조회수 합계({@code post_view_daily}). 없는 날은 빠진다. */
    public Map<LocalDate, Long> dailyViews(long me, LocalDate from, LocalDate to) {
        Map<LocalDate, Long> out = new LinkedHashMap<>();
        jdbc.sql(
                        """
                        SELECT d.view_date, SUM(d.views) FROM post_view_daily d
                        JOIN post p ON p.id = d.post_id
                        WHERE %s AND d.view_date BETWEEN :from AND :to GROUP BY d.view_date
                        """
                                .formatted(MY_POST))
                .param("me", me)
                .param("from", from)
                .param("to", to)
                .query(
                        (RowCallbackHandler)
                                rs -> out.put(rs.getObject(1, LocalDate.class), rs.getLong(2)));
        return out;
    }

    /** 날짜(서비스 시간대)별 받은 좋아요·댓글 수. 없는 날은 빠진다. */
    public Map<LocalDate, DayRow> dailyReactions(long me, OffsetDateTime fromStart, ZoneId zone) {
        Map<LocalDate, DayRow> out = new LinkedHashMap<>();
        jdbc.sql(
                        """
                        SELECT day, SUM(likes), SUM(comments) FROM (
                            SELECT (l.created_at AT TIME ZONE :tz)::date AS day, 1 AS likes, 0 AS comments
                            FROM post_like l JOIN post p ON p.id = l.post_id
                            WHERE %1$s AND l.member_id <> :me AND l.created_at >= :from
                            UNION ALL
                            SELECT (c.created_at AT TIME ZONE :tz)::date, 0, 1
                            FROM comment c JOIN post p ON p.id = c.post_id
                            WHERE %1$s AND c.author_id <> :me AND c.deleted_at IS NULL
                              AND c.hidden_at IS NULL AND c.created_at >= :from
                        ) r GROUP BY day
                        """
                                .formatted(MY_POST))
                .param("me", me)
                .param("tz", zone.getId())
                .param("from", fromStart)
                .query(
                        (RowCallbackHandler)
                                rs -> {
                                    LocalDate day = rs.getObject(1, LocalDate.class);
                                    out.put(day, new DayRow(day, rs.getLong(2), rs.getLong(3)));
                                });
        return out;
    }

    /** 누적 조회수({@code post.view_count} 합계, 지운 글 제외). */
    public long totalViews(long me) {
        return jdbc.sql(
                        "SELECT COALESCE(SUM(p.view_count), 0) FROM post p WHERE %s"
                                .formatted(MY_POST))
                .param("me", me)
                .query(Long.class)
                .single();
    }

    /**
     * {@code from} 이후 조회수가 많은 내 글(공개 범위 무관 — 본인만 보는 화면이다, 숨긴 글 제외).
     *
     * @param limit 최대 개수
     */
    public List<TopPostRow> topPosts(long me, LocalDate from, int limit) {
        return jdbc.sql(
                        """
                        SELECT p.id, p.title, p.visibility, SUM(d.views) AS views
                        FROM post_view_daily d JOIN post p ON p.id = d.post_id
                        WHERE %s AND p.hidden_at IS NULL AND d.view_date >= :from
                        GROUP BY p.id, p.title, p.visibility
                        ORDER BY views DESC, p.id DESC
                        LIMIT :limit
                        """
                                .formatted(MY_POST))
                .param("me", me)
                .param("from", from)
                .param("limit", limit)
                .query(
                        (rs, i) ->
                                new TopPostRow(
                                        rs.getLong("id"),
                                        rs.getString("title"),
                                        rs.getString("visibility"),
                                        rs.getLong("views")))
                .list();
    }
}
