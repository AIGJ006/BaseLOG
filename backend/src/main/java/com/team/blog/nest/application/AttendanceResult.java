package com.team.blog.nest.application;

/**
 * 출석 결과 (021 contracts {@code attend}).
 *
 * @param attended 이번 요청으로 출석했나 (오늘 이미 했으면 {@code false})
 * @param pointsGained 이번에 받은 포인트 (출석 + 연속 보너스)
 * @param grew 이번 출석으로 새가 자랐나
 * @param me 출석 뒤 내 둥지
 */
public record AttendanceResult(boolean attended, int pointsGained, boolean grew, MyNestView me) {}
