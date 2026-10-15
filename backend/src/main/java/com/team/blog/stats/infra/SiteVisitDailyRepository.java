package com.team.blog.stats.infra;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 일별 방문자 수 ({@code site_visit_daily}, stats 모듈 소유, 024). 날짜와 수뿐이다. */
@Repository
public class SiteVisitDailyRepository {

    /** 하루 한 줄. */
    public record Row(LocalDate date, long visitors, long memberVisitors) {}

    private final JdbcClient jdbc;

    public SiteVisitDailyRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 그날 수를 남긴다. 이미 있으면 큰 값을 남긴다(Redis가 비어도 줄지 않게). */
    public void upsertMax(LocalDate date, long visitors, long memberVisitors) {
        jdbc.sql(
                        """
                        INSERT INTO site_visit_daily (visit_date, visitors, member_visitors)
                        VALUES (:d, :v, :m)
                        ON CONFLICT (visit_date) DO UPDATE SET
                            visitors = GREATEST(site_visit_daily.visitors, EXCLUDED.visitors),
                            member_visitors = GREATEST(site_visit_daily.member_visitors, EXCLUDED.member_visitors),
                            updated_at = CURRENT_TIMESTAMP
                        """)
                .param("d", date)
                .param("v", visitors)
                .param("m", memberVisitors)
                .update();
    }

    /** {@code from}~{@code to}(둘 다 포함) 날짜 순. 없는 날은 빠진다. */
    public List<Row> findRange(LocalDate from, LocalDate to) {
        return jdbc.sql(
                        """
                        SELECT visit_date, visitors, member_visitors FROM site_visit_daily
                        WHERE visit_date BETWEEN :from AND :to ORDER BY visit_date
                        """)
                .param("from", from)
                .param("to", to)
                .query(
                        (rs, i) ->
                                new Row(
                                        rs.getObject("visit_date", LocalDate.class),
                                        rs.getLong("visitors"),
                                        rs.getLong("member_visitors")))
                .list();
    }

    /** {@code before}보다 이른 날의 방문자 합계. */
    public long sumBefore(LocalDate before) {
        return jdbc.sql(
                        "SELECT COALESCE(SUM(visitors), 0) FROM site_visit_daily WHERE visit_date < :d")
                .param("d", before)
                .query(Long.class)
                .single();
    }

    /** 처음 센 날. 아직 없으면 빈 값. */
    public Optional<LocalDate> firstDate() {
        return jdbc.sql("SELECT MIN(visit_date) FROM site_visit_daily")
                .query(LocalDate.class)
                .optional();
    }
}
