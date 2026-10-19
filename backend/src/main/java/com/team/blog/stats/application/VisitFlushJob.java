package com.team.blog.stats.application;

import com.team.blog.post.application.exception.AutosaveUnavailableException;
import com.team.blog.stats.infra.BlogVisitDailyRepository;
import com.team.blog.stats.infra.RedisBlogVisitStore;
import com.team.blog.stats.infra.RedisVisitStore;
import com.team.blog.stats.infra.SiteVisitDailyRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 방문자 수 옮기기 (024). {@code blog.stats.visit-flush-interval}(기본 5분)마다 그제·어제·오늘 방문자 수를 Redis에서 읽어
 * {@code site_visit_daily}에 남긴다(큰 값). 어제도 다시 보는 것은 자정 직전 방문을, 그제까지 보는 것은 Redis가 하루 넘게 멈췄을 때 TTL(3일)
 * 안의 수를 놓치지 않으려는 것이다. Redis 장애면 그 회차를 건너뛴다. ShedLock {@code visit-flush}.
 *
 * <p>031 둥지별 방문자({@link RedisBlogVisitStore} → {@code blog_visit_daily})도 같은 회차에 같은 방식으로 옮긴다.
 */
@Component
public class VisitFlushJob {

    private final RedisVisitStore store;
    private final SiteVisitDailyRepository daily;
    private final RedisBlogVisitStore blogStore;
    private final BlogVisitDailyRepository blogDaily;
    private final Clock clock;
    private final ZoneId zone;

    public VisitFlushJob(
            RedisVisitStore store,
            SiteVisitDailyRepository daily,
            RedisBlogVisitStore blogStore,
            BlogVisitDailyRepository blogDaily,
            Clock clock,
            ZoneId serviceZoneId) {
        this.store = store;
        this.daily = daily;
        this.blogStore = blogStore;
        this.blogDaily = blogDaily;
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

    /** 그제·어제·오늘을 옮긴다(시험에서 직접 부른다). */
    public void flush(LocalDate today) {
        try {
            for (LocalDate date : new LocalDate[] {today.minusDays(2), today.minusDays(1), today}) {
                store.count(date)
                        .filter(c -> c.visitors() > 0)
                        .ifPresent(c -> daily.upsertMax(date, c.visitors(), c.memberVisitors()));
                blogStore
                        .countAll(date)
                        .ifPresent(
                                byOwner ->
                                        byOwner.forEach(
                                                (owner, visitors) -> {
                                                    if (visitors > 0) {
                                                        blogDaily.upsertMax(owner, date, visitors);
                                                    }
                                                }));
            }
        } catch (AutosaveUnavailableException e) {
            // Redis 메모리 부족 — 다음 회차에 옮긴다
        }
    }
}
