package com.team.blog.stats.application;

import com.team.blog.post.application.exception.AutosaveUnavailableException;
import com.team.blog.shared.security.Viewer;
import com.team.blog.stats.infra.BlogVisitDailyRepository;
import com.team.blog.stats.infra.MyStatsQueryRepository;
import com.team.blog.stats.infra.RedisBlogVisitStore;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 둥지 통계 (2026-10-15 민서 요청, 내 둥지 관리 [통계] 탭). 로그인한 본인 글만 센다. 조회수는 글 상세 조회수와 같은 기준(009 — 같은 사람은
 * 24시간에 한 번, 봇 제외)이고, 일별 조회수는 1분마다 모은다.
 *
 * <p>031 둥지 방문자: {@code blog_visit_daily}(5분마다 옮긴 수)에 어제·오늘은 Redis의 지금 수를 더 큰 쪽으로 합친다(관리자 통계와 같은
 * 방식). 주인 본인·관리자·봇은 세지 않는다.
 */
@Service
public class MyStatsService {

    /** 일별 그래프 날 수, 많이 본 글 기간. */
    static final int DAYS = 30;

    /** 많이 본 글 개수. */
    static final int TOP_POSTS = 5;

    private final MyStatsQueryRepository stats;
    private final BlogVisitDailyRepository visits;
    private final RedisBlogVisitStore liveVisits;
    private final Clock clock;
    private final ZoneId zone;

    public MyStatsService(
            MyStatsQueryRepository stats,
            BlogVisitDailyRepository visits,
            RedisBlogVisitStore liveVisits,
            Clock clock,
            ZoneId serviceZoneId) {
        this.stats = stats;
        this.visits = visits;
        this.liveVisits = liveVisits;
        this.clock = clock;
        this.zone = serviceZoneId;
    }

    @Transactional(readOnly = true)
    public MyStats get(Viewer viewer) {
        long me = viewer.id();
        LocalDate today = LocalDate.now(clock.withZone(zone));
        LocalDate from = today.minusDays(DAYS - 1L);
        LocalDate weekFrom = today.minusDays(6);
        OffsetDateTime todayStart = today.atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime weekStart = weekFrom.atStartOfDay(zone).toOffsetDateTime();

        Map<LocalDate, Long> views = stats.dailyViews(me, from, today);
        Map<LocalDate, Long> visitors = new HashMap<>(visits.findRange(me, from, today));
        for (LocalDate date : new LocalDate[] {today.minusDays(1), today}) {
            live(date, me).ifPresent(n -> visitors.merge(date, n, Math::max));
        }
        Map<LocalDate, MyStatsQueryRepository.DayRow> reactions =
                stats.dailyReactions(me, from.atStartOfDay(zone).toOffsetDateTime(), zone);

        List<MyStats.Day> daily = new ArrayList<>(DAYS);
        long views7 = 0;
        long views30 = 0;
        long visitors7 = 0;
        long visitors30 = 0;
        for (LocalDate d = from; !d.isAfter(today); d = d.plusDays(1)) {
            long v = views.getOrDefault(d, 0L);
            long vis = visitors.getOrDefault(d, 0L);
            MyStatsQueryRepository.DayRow r = reactions.get(d);
            daily.add(
                    new MyStats.Day(
                            d, vis, v, r == null ? 0 : r.likes(), r == null ? 0 : r.comments()));
            views30 += v;
            visitors30 += vis;
            if (!d.isBefore(weekFrom)) {
                views7 += v;
                visitors7 += vis;
            }
        }

        return new MyStats(
                today,
                new MyStats.Visitors(
                        visitors.getOrDefault(today, 0L),
                        visitors7,
                        visitors30,
                        visits.sumBefore(me, from) + visitors30),
                new MyStats.Views(
                        views.getOrDefault(today, 0L), views7, views30, stats.totalViews(me)),
                daily,
                counts(stats.posts(me, todayStart, weekStart)),
                counts(stats.likes(me, todayStart, weekStart)),
                counts(stats.comments(me, todayStart, weekStart)),
                stats.topPosts(me, from, TOP_POSTS).stream()
                        .map(
                                r ->
                                        new MyStats.TopPost(
                                                r.postId(), r.title(), r.visibility(), r.views()))
                        .toList());
    }

    private Optional<Long> live(LocalDate date, long owner) {
        try {
            return liveVisits.count(date, owner);
        } catch (AutosaveUnavailableException e) {
            return Optional.empty();
        }
    }

    private static MyStats.Counts counts(MyStatsQueryRepository.Counts c) {
        return new MyStats.Counts(c.total(), c.today(), c.last7Days());
    }
}
