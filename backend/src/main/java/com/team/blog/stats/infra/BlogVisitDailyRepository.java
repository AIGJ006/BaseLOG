package com.team.blog.stats.infra;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 둥지별 일별 방문자 수 ({@code blog_visit_daily}, stats 모듈 소유, 031). 주인 번호·날짜와 수뿐이다. */
@Repository
public class BlogVisitDailyRepository {

    private final JdbcClient jdbc;

    public BlogVisitDailyRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 그날 수를 남긴다. 이미 있으면 큰 값을 남긴다(Redis가 비어도 줄지 않게). */
    public void upsertMax(long ownerId, LocalDate date, long visitors) {
        jdbc.sql(
                        """
                        INSERT INTO blog_visit_daily (owner_id, visit_date, visitors)
                        VALUES (:o, :d, :v)
                        ON CONFLICT (owner_id, visit_date) DO UPDATE SET
                            visitors = GREATEST(blog_visit_daily.visitors, EXCLUDED.visitors),
                            updated_at = CURRENT_TIMESTAMP
                        """)
                .param("o", ownerId)
                .param("d", date)
                .param("v", visitors)
                .update();
    }

    /** {@code from}~{@code to}(둘 다 포함) 날짜별 방문자 수. 없는 날은 빠진다. */
    public Map<LocalDate, Long> findRange(long ownerId, LocalDate from, LocalDate to) {
        Map<LocalDate, Long> out = new LinkedHashMap<>();
        jdbc.sql(
                        """
                        SELECT visit_date, visitors FROM blog_visit_daily
                        WHERE owner_id = :o AND visit_date BETWEEN :from AND :to ORDER BY visit_date
                        """)
                .param("o", ownerId)
                .param("from", from)
                .param("to", to)
                .query(
                        (RowCallbackHandler)
                                rs -> out.put(rs.getObject(1, LocalDate.class), rs.getLong(2)));
        return out;
    }

    /** {@code before}보다 이른 날의 방문자 합계. */
    public long sumBefore(long ownerId, LocalDate before) {
        return jdbc.sql(
                        """
                        SELECT COALESCE(SUM(visitors), 0) FROM blog_visit_daily
                        WHERE owner_id = :o AND visit_date < :d
                        """)
                .param("o", ownerId)
                .param("d", before)
                .query(Long.class)
                .single();
    }
}
