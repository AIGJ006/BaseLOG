package com.team.blog.nest.application;

import com.team.blog.nest.domain.BirdGrowth;
import com.team.blog.nest.domain.NestItem;
import com.team.blog.nest.domain.NestPointReason;
import com.team.blog.nest.infra.NestRepository;
import com.team.blog.nest.infra.NestRepository.ItemRow;
import com.team.blog.nest.infra.NestRepository.NestRow;
import com.team.blog.nest.infra.NestRepository.PointRow;
import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 둥지 읽기 (021 US1·US3). 둥지 줄이 아직 없으면 기본 둥지(아기 새·기본 숲)로 보인다. */
@Service
@Transactional(readOnly = true)
public class NestQueryService {

    /** 포인트 기록 한 쪽 크기. */
    static final int HISTORY_PAGE = 30;

    private final NestRepository nests;
    private final NestProperties properties;
    private final Clock clock;
    private final ZoneId zone;

    public NestQueryService(
            NestRepository nests, NestProperties properties, Clock clock, ZoneId serviceZoneId) {
        this.nests = nests;
        this.properties = properties;
        this.clock = clock;
        this.zone = serviceZoneId;
    }

    /** 서비스 시간대 기준 오늘. */
    public LocalDate today() {
        return LocalDate.ofInstant(clock.instant(), zone);
    }

    /** 남이 보는 둥지 모습. */
    public NestView publicNest(long memberId) {
        NestRow row = nests.find(memberId).orElse(NestRow.empty(memberId));
        return view(row, nests.items(memberId), today());
    }

    /** 내 둥지 꾸미기 화면 한 번에. */
    public MyNestView myNest(long memberId) {
        LocalDate today = today();
        NestRow row = nests.find(memberId).orElse(NestRow.empty(memberId));
        List<ItemRow> owned = nests.items(memberId);
        NestView view = view(row, owned, today);
        int streak = BirdGrowth.currentStreak(row.streakDays(), row.lastAttendedOn(), today);
        Map<String, ItemRow> ownedByCode =
                owned.stream().collect(Collectors.toMap(ItemRow::code, Function.identity()));
        List<MyNestView.ShopItemView> items = new ArrayList<>();
        for (NestItem item : NestItem.values()) {
            boolean has = item.free() || ownedByCode.containsKey(item.code());
            boolean equipped =
                    switch (item.kind()) {
                        case BACKGROUND -> item.code().equals(view.background());
                        case NEST -> item.code().equals(view.nestType());
                        case PROP, ACCESSORY -> view.decorations().contains(item.code());
                    };
            items.add(
                    new MyNestView.ShopItemView(
                            item.code(),
                            item.kind().name(),
                            item.displayName(),
                            item.price(),
                            item.slot(),
                            has,
                            equipped));
        }
        List<MyNestView.TodayEarning> earnings =
                List.of(
                        earning(
                                memberId,
                                NestPointReason.POST,
                                today,
                                properties.postDailyCap(),
                                properties.postPoints()),
                        earning(
                                memberId,
                                NestPointReason.COMMENT,
                                today,
                                properties.commentDailyCap(),
                                properties.commentPoints()),
                        earning(
                                memberId,
                                NestPointReason.LIKE_RECEIVED,
                                today,
                                properties.likeDailyCap(),
                                properties.likePoints()));
        return new MyNestView(
                view,
                nests.balance(memberId),
                today.equals(row.lastAttendedOn()),
                row.bestStreakDays(),
                BirdGrowth.daysToGrow(view.level(), streak, properties.growEveryDays()),
                earnings,
                items);
    }

    /** 포인트 기록 한 쪽 (새것부터). */
    public PointHistoryView history(long memberId, Long before) {
        List<PointRow> rows = nests.history(memberId, before, HISTORY_PAGE + 1);
        boolean more = rows.size() > HISTORY_PAGE;
        List<PointRow> page = more ? rows.subList(0, HISTORY_PAGE) : rows;
        List<PointHistoryView.Entry> items =
                page.stream()
                        .map(
                                r ->
                                        new PointHistoryView.Entry(
                                                r.id(),
                                                r.reason(),
                                                label(r.reason(), r.sourceKey()),
                                                r.amount(),
                                                r.createdAt()))
                        .toList();
        return new PointHistoryView(items, more ? page.get(page.size() - 1).id() : null);
    }

    private MyNestView.TodayEarning earning(
            long memberId, NestPointReason reason, LocalDate today, int cap, int points) {
        return new MyNestView.TodayEarning(
                reason.name(), nests.countOn(memberId, reason.name(), today), cap, points);
    }

    private NestView view(NestRow row, List<ItemRow> owned, LocalDate today) {
        int level =
                BirdGrowth.currentLevel(
                        row.birdLevel(), row.lastAttendedOn(), today, properties.shrinkAfterDays());
        List<String> decorations =
                owned.stream()
                        .filter(ItemRow::equipped)
                        .map(ItemRow::code)
                        .filter(c -> NestItem.fromCode(c).filter(NestItem::decoration).isPresent())
                        .toList();
        return new NestView(
                level,
                BirdGrowth.levelName(level),
                BirdGrowth.currentStreak(row.streakDays(), row.lastAttendedOn(), today),
                known(row.background(), NestItem.DEFAULT_BACKGROUND),
                known(row.nestType(), NestItem.DEFAULT_NEST),
                decorations);
    }

    /** 목록에서 빠진 옛 코드는 기본 물건으로 보인다. */
    private static String known(String code, NestItem fallback) {
        return NestItem.fromCode(code).filter(i -> i.kind() == fallback.kind()).isPresent()
                ? code
                : fallback.code();
    }

    static String label(String reason, String sourceKey) {
        return switch (reason) {
            case "ATTENDANCE" -> "출석";
            case "STREAK_BONUS" -> "연속 출석 보너스";
            case "POST" -> "글 등록";
            case "COMMENT" -> "댓글";
            case "LIKE_RECEIVED" -> "받은 좋아요";
            case "PURCHASE" ->
                    "물건 사기 · "
                            + NestItem.fromCode(sourceKey.substring(sourceKey.indexOf(':') + 1))
                                    .map(NestItem::displayName)
                                    .orElse("사라진 물건");
            default -> "포인트 조정";
        };
    }
}
