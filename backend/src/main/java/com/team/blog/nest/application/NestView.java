package com.team.blog.nest.application;

import java.util.List;

/**
 * 둥지 모습 — 누구나 본다 (021 contracts {@code getMemberNest}).
 *
 * @param level 오늘 기준 새 크기 1~5 (오래 빠졌으면 줄어든 값)
 * @param levelName 크기 이름 (아기 새 … 큰 새)
 * @param streakDays 오늘 기준 연속 출석 (끊겼으면 0)
 * @param background 장착한 배경 코드
 * @param border 장착한 테두리 코드
 * @param decorations 장착한 장식 코드들
 */
public record NestView(
        int level,
        String levelName,
        int streakDays,
        String background,
        String border,
        List<String> decorations) {}
