package com.team.blog.stats.application;

import com.team.blog.post.application.exception.AutosaveUnavailableException;
import com.team.blog.stats.infra.RedisVisitStore;
import com.team.blog.stats.infra.SiteVisitDailyRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 방문자 수 옮기기 (024). {@code blog.stats.visit-flush-interval}(기본 5분)마다 어제·오늘 방문자 수를 Redis에서 읽어 {@code
 * site_visit_daily}에 남긴다(큰 값). 어제도 다시 보는 것은 자정 직전 방문을 놓치지 않으려는 것이다. Redis 장애면 그 회차를 건너뛴다. ShedLock
 * {@code visit-flush}.
 */
@Component
public class VisitFlushJob {

    private final RedisVisitStore store;
    private final SiteVisitDailyRepository daily;
    private final Clock clock;
    private final ZoneId zone;

    public VisitFlushJob(
            RedisVisitStore store,
            SiteVisitDailyRepository daily,
            Clock clock,
            ZoneId serviceZoneId) {
        this.store = store;
        this.daily = daily;
        this.clock = clock;
        this.zone = serviceZoneId;
    }

    @Scheduled(
            fixedDelayString = "${blog.stats.visit-flush-interval:5m}",
            initialDelayString = "${blog.stats.visit-flush-interval:5m}")
    @SchedulerLock(name = "visit-flush", lockAtMostFor = "PT5M")
    public void run() {
        flush(LocalDate.now(clock.withZone(zone)));
    }

    /** 어제·오늘을 옮긴다(시험에서 직접 부른다). */
    public void flush(LocalDate today) {
        try {
            for (LocalDate date : new LocalDate[] {today.minusDays(1), today}) {
                store.count(date)
                        .filter(c -> c.visitors() > 0)
                        .ifPresent(c -> daily.upsertMax(date, c.visitors(), c.memberVisitors()));
            }
        } catch (AutosaveUnavailableException e) {
            // Redis 메모리 부족 — 다음 회차에 옮긴다
        }
    }
}
