package com.team.blog.stats.application;

import com.team.blog.shared.security.Viewer;
import com.team.blog.stats.infra.MyStatsQueryRepository;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 내 둥지 통계 (2026-10-15 민서 요청, 내 둥지 관리 [통계] 탭). 로그인한 본인 글만 센다. 조회수는 글 상세 조회수와 같은 기준(009 — 같은 사람은
 * 24시간에 한 번, 봇 제외)이고, 일별 조회수는 1분마다 모은다. 방문자 수는 둥지별로 세지 않아 없다.
 */
@Service
public class MyStatsService {

    /** 일별 그래프 날 수, 많이 본 글 기간. */
    static final int DAYS = 30;

    /** 많이 본 글 개수. */
    static final int TOP_POSTS = 5;

    private final MyStatsQueryRepository stats;
    private final Clock clock;
    private final ZoneId zone;

    public MyStatsService(MyStatsQueryRepository stats, Clock clock, ZoneId serviceZoneId) {
        this.stats = stats;
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
        Map<LocalDate, MyStatsQueryRepository.DayRow> reactions =
                stats.dailyReactions(me, from.atStartOfDay(zone).toOffsetDateTime(), zone);

        List<MyStats.Day> daily = new ArrayList<>(DAYS);
        long views7 = 0;
        long views30 = 0;
        for (LocalDate d = from; !d.isAfter(today); d = d.plusDays(1)) {
            long v = views.getOrDefault(d, 0L);
            MyStatsQueryRepository.DayRow r = reactions.get(d);
            daily.add(
                    new MyStats.Day(d, v, r == null ? 0 : r.likes(), r == null ? 0 : r.comments()));
            views30 += v;
            if (!d.isBefore(weekFrom)) {
                views7 += v;
            }
        }

        return new MyStats(
                today,
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

    private static MyStats.Counts counts(MyStatsQueryRepository.Counts c) {
        return new MyStats.Counts(c.total(), c.today(), c.last7Days());
    }
}
