package com.team.blog.stats.application;

import com.team.blog.moderation.application.ModerationAccess;
import com.team.blog.post.application.exception.AutosaveUnavailableException;
import com.team.blog.shared.security.Viewer;
import com.team.blog.stats.infra.RedisVisitStore;
import com.team.blog.stats.infra.RedisVisitStore.DayCount;
import com.team.blog.stats.infra.SiteVisitDailyRepository;
import com.team.blog.stats.infra.StatsQueryRepository;
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
 * 관리자 통계 (024). 관리자만(아니면 404 — 014 {@link ModerationAccess}). 오늘·어제 방문자는 DB에 옮긴 수와 Redis의 지금 수 중 큰
 * 값이다(옮기기는 5분마다).
 */
@Service
public class AdminStatsService {

    /** 일별 그래프 날 수. */
    static final int DAYS = 30;

    /** 많이 본 글 개수. */
    static final int TOP_POSTS = 5;

    private final ModerationAccess access;
    private final SiteVisitDailyRepository visits;
    private final RedisVisitStore liveVisits;
    private final StatsQueryRepository stats;
    private final Clock clock;
    private final ZoneId zone;

    public AdminStatsService(
            ModerationAccess access,
            SiteVisitDailyRepository visits,
            RedisVisitStore liveVisits,
            StatsQueryRepository stats,
            Clock clock,
            ZoneId serviceZoneId) {
        this.access = access;
        this.visits = visits;
        this.liveVisits = liveVisits;
        this.stats = stats;
        this.clock = clock;
        this.zone = serviceZoneId;
    }

    @Transactional(readOnly = true)
    public AdminStats get(Viewer viewer) {
        access.requireAdmin(viewer);
        LocalDate today = LocalDate.now(clock.withZone(zone));
        LocalDate from = today.minusDays(DAYS - 1L);
        LocalDate weekFrom = today.minusDays(6);

        Map<LocalDate, DayCount> byDate = new HashMap<>();
        for (SiteVisitDailyRepository.Row row : visits.findRange(from, today)) {
            byDate.put(row.date(), new DayCount(row.visitors(), row.memberVisitors()));
        }
        for (LocalDate date : new LocalDate[] {today.minusDays(1), today}) {
            live(date)
                    .ifPresent(liveCount -> byDate.merge(date, liveCount, AdminStatsService::max));
        }
        Map<LocalDate, Long> views = stats.dailyViews(from, today);

        List<AdminStats.Day> daily = new ArrayList<>(DAYS);
        long last7 = 0;
        long last30 = 0;
        long views7 = 0;
        for (LocalDate d = from; !d.isAfter(today); d = d.plusDays(1)) {
            DayCount c = byDate.getOrDefault(d, new DayCount(0, 0));
            long v = views.getOrDefault(d, 0L);
            daily.add(new AdminStats.Day(d, c.visitors(), c.memberVisitors(), v));
            last30 += c.visitors();
            if (!d.isBefore(weekFrom)) {
                last7 += c.visitors();
                views7 += v;
            }
        }
        long total = visits.sumBefore(from) + last30;
        LocalDate since = visits.firstDate().orElse(last30 > 0 ? firstNonZero(daily) : null);

        OffsetDateTime todayStart = today.atStartOfDay(zone).toOffsetDateTime();
        OffsetDateTime weekStart = weekFrom.atStartOfDay(zone).toOffsetDateTime();
        return new AdminStats(
                today,
                new AdminStats.Visitors(
                        countOn(byDate, today),
                        countOn(byDate, today.minusDays(1)),
                        last7,
                        last30,
                        total,
                        since),
                daily,
                counts(stats.members(todayStart, weekStart)),
                counts(stats.posts(todayStart, weekStart)),
                counts(stats.comments(todayStart, weekStart)),
                new AdminStats.Views(views.getOrDefault(today, 0L), views7, stats.totalViews()),
                stats.topPosts(weekFrom, TOP_POSTS).stream()
                        .map(
                                r ->
                                        new AdminStats.TopPost(
                                                r.postId(), r.title(), r.handle(), r.views()))
                        .toList());
    }

    private Optional<DayCount> live(LocalDate date) {
        try {
            return liveVisits.count(date);
        } catch (AutosaveUnavailableException e) {
            return Optional.empty();
        }
    }

    private static DayCount max(DayCount a, DayCount b) {
        return new DayCount(
                Math.max(a.visitors(), b.visitors()),
                Math.max(a.memberVisitors(), b.memberVisitors()));
    }

    private static long countOn(Map<LocalDate, DayCount> byDate, LocalDate date) {
        DayCount c = byDate.get(date);
        return c == null ? 0 : c.visitors();
    }

    private static LocalDate firstNonZero(List<AdminStats.Day> daily) {
        return daily.stream()
                .filter(d -> d.visitors() > 0)
                .findFirst()
                .map(AdminStats.Day::date)
                .orElse(null);
    }

    private static AdminStats.Counts counts(StatsQueryRepository.Counts c) {
        return new AdminStats.Counts(c.total(), c.today(), c.last7Days());
    }
}
