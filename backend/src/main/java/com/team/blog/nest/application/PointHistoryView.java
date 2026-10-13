package com.team.blog.nest.application;

import java.time.Instant;
import java.util.List;

/**
 * 포인트 기록 한 쪽 (021 contracts {@code listMyNestPoints}). 새것부터.
 *
 * @param nextBefore 다음 쪽을 부를 {@code before} 값 (끝이면 {@code null})
 */
public record PointHistoryView(List<Entry> items, Long nextBefore) {

    /**
     * @param label 화면에 보일 까닭 (예: "출석", "물건 사기 · 노을")
     * @param amount 받은 포인트(양수)·쓴 포인트(음수)
     */
    public record Entry(long id, String reason, String label, int amount, Instant createdAt) {}
}
