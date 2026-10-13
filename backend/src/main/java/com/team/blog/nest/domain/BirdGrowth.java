package com.team.blog.nest.domain;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * 새 크기 규칙 (021 FR-010~FR-014). 크기는 1~{@link #MAX_LEVEL}단계다.
 *
 * <ul>
 *   <li>연속 출석이 {@code growEveryDays}의 배수가 되는 날 한 단계 자란다.
 *   <li>마지막 출석 다음 날부터 빠진 날이 {@code shrinkAfterDays}일을 넘으면, 넘은 날 하루마다 한 단계씩 작아진다(1단계 밑으로는 안 내려감).
 *   <li>작아진 크기는 읽을 때 셈한다 — 매일 도는 작업 없이 다음 출석 때 저장한다.
 * </ul>
 */
public final class BirdGrowth {

    public static final int MIN_LEVEL = 1;
    public static final int MAX_LEVEL = 5;

    private static final String[] NAMES = {"아기 새", "꼬마 새", "어린 새", "어른 새", "큰 새"};

    private BirdGrowth() {}

    public static String levelName(int level) {
        return NAMES[clamp(level) - 1];
    }

    /** 오늘 기준 크기 — 오래 빠졌으면 줄어든 값. */
    public static int currentLevel(
            int storedLevel, LocalDate lastAttendedOn, LocalDate today, int shrinkAfterDays) {
        if (lastAttendedOn == null) {
            return clamp(storedLevel);
        }
        long missed = ChronoUnit.DAYS.between(lastAttendedOn, today) - 1;
        long shrink = Math.max(0, missed - shrinkAfterDays);
        return clamp((int) Math.max(MIN_LEVEL, storedLevel - Math.min(shrink, MAX_LEVEL)));
    }

    /** 오늘 기준 연속 출석 — 어제나 오늘 출석하지 않았으면 끊긴 것(0). */
    public static int currentStreak(int storedStreak, LocalDate lastAttendedOn, LocalDate today) {
        if (lastAttendedOn == null) {
            return 0;
        }
        long gap = ChronoUnit.DAYS.between(lastAttendedOn, today);
        return gap <= 1 ? storedStreak : 0;
    }

    /** 오늘 출석했을 때의 연속 일수. */
    public static int streakAfterAttending(
            int storedStreak, LocalDate lastAttendedOn, LocalDate today) {
        if (lastAttendedOn != null && ChronoUnit.DAYS.between(lastAttendedOn, today) == 1) {
            return storedStreak + 1;
        }
        return 1;
    }

    /** 오늘 출석했을 때의 크기 — 줄어든 크기에서 시작해, 연속 일수가 배수면 한 단계 자란다. */
    public static int levelAfterAttending(int currentLevel, int newStreak, int growEveryDays) {
        if (newStreak > 0 && newStreak % growEveryDays == 0) {
            return clamp(currentLevel + 1);
        }
        return clamp(currentLevel);
    }

    /** 다음 성장까지 남은 출석 일수 (오늘 출석 포함 전 기준). 다 자랐으면 0. */
    public static int daysToGrow(int currentLevel, int currentStreak, int growEveryDays) {
        if (currentLevel >= MAX_LEVEL) {
            return 0;
        }
        return growEveryDays - (currentStreak % growEveryDays);
    }

    private static int clamp(int level) {
        return Math.max(MIN_LEVEL, Math.min(MAX_LEVEL, level));
    }
}
