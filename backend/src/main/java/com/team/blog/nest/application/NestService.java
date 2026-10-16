package com.team.blog.nest.application;

import com.team.blog.nest.domain.BirdGrowth;
import com.team.blog.nest.domain.NestItem;
import com.team.blog.nest.domain.NestPointReason;
import com.team.blog.nest.domain.NestReasonCode;
import com.team.blog.nest.infra.NestRepository;
import com.team.blog.nest.infra.NestRepository.ItemRow;
import com.team.blog.nest.infra.NestRepository.NestRow;
import com.team.blog.shared.error.BusinessRuleException;
import com.team.blog.shared.security.AccountStatusGuard;
import com.team.blog.shared.security.ActionKind;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 출석·사기·장착 (021 US1·US2). 판정 순서: 계정 상태(정지·탈퇴 유예 403, {@code ACCOUNT_WRITE}) → 둥지 줄 잠금(같은 회원의 둥지 쓰기를
 * 한 줄로) → 규칙(400·409).
 */
@Service
public class NestService {

    private static final Logger log = LoggerFactory.getLogger(NestService.class);

    private final AccountStatusGuard accountStatusGuard;
    private final NestRepository nests;
    private final NestProperties properties;
    private final NestQueryService queries;

    public NestService(
            AccountStatusGuard accountStatusGuard,
            NestRepository nests,
            NestProperties properties,
            NestQueryService queries) {
        this.accountStatusGuard = accountStatusGuard;
        this.nests = nests;
        this.properties = properties;
        this.queries = queries;
    }

    /**
     * 오늘 출석 (FR-001~FR-004). 하루 첫 요청만 포인트를 주고, 같은 날 다시 부르면 아무것도 바꾸지 않는다. 연속 일수가 보너스 주기의 배수면 보너스를 더
     * 준다.
     */
    @Transactional
    public AttendanceResult attend(long memberId) {
        NestRow row = begin(memberId);
        LocalDate today = queries.today();
        if (today.equals(row.lastAttendedOn())) {
            return new AttendanceResult(false, 0, false, queries.myNest(memberId));
        }
        int before =
                BirdGrowth.currentLevel(
                        row.birdLevel(), row.lastAttendedOn(), today, properties.shrinkAfterDays());
        int streak = BirdGrowth.streakAfterAttending(row.streakDays(), row.lastAttendedOn(), today);
        int level = BirdGrowth.levelAfterAttending(before, streak, properties.growEveryDays());
        nests.saveAttendance(
                memberId, level, streak, Math.max(row.bestStreakDays(), streak), today);
        int gained = 0;
        if (nests.addPoint(
                memberId,
                NestPointReason.ATTENDANCE.name(),
                properties.attendancePoints(),
                "ATTEND:" + today,
                today)) {
            gained += properties.attendancePoints();
        }
        if (properties.streakBonusPoints() > 0
                && streak % properties.streakBonusEvery() == 0
                && nests.addPoint(
                        memberId,
                        NestPointReason.STREAK_BONUS.name(),
                        properties.streakBonusPoints(),
                        "STREAK:" + today,
                        today)) {
            gained += properties.streakBonusPoints();
        }
        log.info(
                "둥지 출석: memberId={} streak={} level={}→{} gained={}",
                memberId,
                streak,
                before,
                level,
                gained);
        return new AttendanceResult(true, gained, level > before, queries.myNest(memberId));
    }

    /** 상점에서 사기 (FR-030~FR-033). 기록에 음수 한 줄을 더한다 — 같은 물건은 한 번만. */
    @Transactional
    public MyNestView buy(long memberId, String code) {
        begin(memberId);
        NestItem item =
                NestItem.fromCode(code)
                        .orElseThrow(
                                () -> new BusinessRuleException(NestReasonCode.NEST_ITEM_UNKNOWN));
        if (item.free() || owned(memberId).contains(item.code())) {
            throw new BusinessRuleException(NestReasonCode.NEST_ITEM_ALREADY_OWNED);
        }
        if (nests.balance(memberId) < item.price()) {
            throw new BusinessRuleException(NestReasonCode.NEST_POINTS_NOT_ENOUGH);
        }
        nests.addItem(memberId, item.code());
        nests.addPoint(
                memberId,
                NestPointReason.PURCHASE.name(),
                -item.price(),
                "BUY:" + item.code(),
                queries.today());
        log.info("둥지 물건 삼: memberId={} item={} price={}", memberId, item.code(), item.price());
        return queries.myNest(memberId);
    }

    /**
     * 장착 (FR-034~FR-036). 배경·둥지는 하나씩, 새 장식은 가진 것 중 여러 개(새 장식은 머리·얼굴·목 칸마다 하나). 보낸 값으로 통째로 바꾼다 —
     * 배경·둥지가 {@code null}이면 기본 물건.
     */
    @Transactional
    public MyNestView equip(
            long memberId, String background, String nestType, List<String> decorations) {
        begin(memberId);
        Set<String> owned = owned(memberId);
        NestItem bg = equippable(background, NestItem.DEFAULT_BACKGROUND, owned);
        NestItem nest = equippable(nestType, NestItem.DEFAULT_NEST, owned);
        Set<String> decos = new LinkedHashSet<>();
        Set<String> slots = new HashSet<>();
        for (String code : decorations == null ? List.<String>of() : decorations) {
            NestItem deco =
                    NestItem.fromCode(code)
                            .filter(NestItem::decoration)
                            .filter(i -> owned.contains(i.code()))
                            .orElseThrow(
                                    () ->
                                            new BusinessRuleException(
                                                    NestReasonCode.NEST_ITEM_NOT_OWNED));
            if (decos.add(deco.code()) && deco.slot() != null && !slots.add(deco.slot())) {
                throw new BusinessRuleException(NestReasonCode.NEST_SLOT_TAKEN);
            }
        }
        nests.saveFrame(memberId, bg.code(), nest.code());
        nests.equipDecorations(memberId, List.copyOf(decos));
        return queries.myNest(memberId);
    }

    /** 시험용: 새 단계를 바로 바꾼다(1~4로 맞춤). {@code blog.nest.dev-tools}가 켜진 로컬에서만 부른다. */
    @Transactional
    public MyNestView setLevelForTesting(long memberId, int level) {
        begin(memberId);
        nests.saveLevel(memberId, Math.clamp(level, BirdGrowth.MIN_LEVEL, BirdGrowth.MAX_LEVEL));
        return queries.myNest(memberId);
    }

    /** 시험용: 포인트를 넣는다(1~100000으로 맞춤, 기록은 "포인트 조정"). 로컬에서만 부른다. */
    @Transactional
    public MyNestView givePointsForTesting(long memberId, int amount) {
        begin(memberId);
        LocalDate today = queries.today();
        nests.addPoint(
                memberId,
                NestPointReason.ADJUST.name(),
                Math.clamp(amount, 1, 100_000),
                "DEV:" + UUID.randomUUID(),
                today);
        return queries.myNest(memberId);
    }

    private NestRow begin(long memberId) {
        accountStatusGuard.requireActive(memberId, ActionKind.ACCOUNT_WRITE);
        nests.ensure(memberId);
        return nests.lock(memberId);
    }

    private Set<String> owned(long memberId) {
        return nests.items(memberId).stream().map(ItemRow::code).collect(Collectors.toSet());
    }

    private static NestItem equippable(String code, NestItem fallback, Set<String> owned) {
        if (code == null) {
            return fallback;
        }
        return NestItem.fromCode(code)
                .filter(i -> i.kind() == fallback.kind())
                .filter(i -> i.free() || owned.contains(i.code()))
                .orElseThrow(() -> new BusinessRuleException(NestReasonCode.NEST_ITEM_NOT_OWNED));
    }
}
