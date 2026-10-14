package com.team.blog.nest.application;

import java.util.List;

/**
 * 내 둥지 꾸미기 화면 (021 contracts {@code getMyNest}).
 *
 * @param nest 둥지 모습
 * @param balance 포인트 잔액
 * @param attendedToday 오늘 출석했나
 * @param bestStreakDays 가장 길었던 연속 출석
 * @param daysToGrow 다음 성장까지 남은 출석 일수 (다 자랐으면 0)
 * @param today 오늘 받은 글·댓글·좋아요 포인트 건수와 상한
 * @param items 상점 물건 전부 (가졌는지·장착했는지)
 * @param devTools 시험용 칸을 보이나 (로컬 프로필만 {@code true})
 */
public record MyNestView(
        NestView nest,
        long balance,
        boolean attendedToday,
        int bestStreakDays,
        int daysToGrow,
        List<TodayEarning> today,
        List<ShopItemView> items,
        boolean devTools) {

    /**
     * @param reason {@code POST}·{@code COMMENT}·{@code LIKE_RECEIVED}
     * @param count 오늘 받은 건수
     * @param cap 하루 최대 건수
     * @param points 1건 포인트
     */
    public record TodayEarning(String reason, int count, int cap, int points) {}

    /**
     * @param kind {@code BACKGROUND}·{@code NEST}·{@code ACCESSORY}
     * @param price 값 (0이면 기본 물건)
     * @param slot 새 장식 칸 ({@code HEAD}·{@code FACE}·{@code NECK}, 없으면 {@code null})
     */
    public record ShopItemView(
            String code,
            String kind,
            String name,
            int price,
            String slot,
            boolean owned,
            boolean equipped) {}
}
