package com.team.blog.nest.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.nest.domain.BirdGrowth;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** 새 크기 규칙 (021 FR-010~FR-014). 자라는 주기 3일, 3일 넘게 빠지면 작아짐. */
class BirdGrowthTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 13);

    @Test
    void 어제_출석했으면_연속이_이어지고_아니면_1부터() {
        assertThat(BirdGrowth.streakAfterAttending(4, TODAY.minusDays(1), TODAY)).isEqualTo(5);
        assertThat(BirdGrowth.streakAfterAttending(4, TODAY.minusDays(2), TODAY)).isEqualTo(1);
        assertThat(BirdGrowth.streakAfterAttending(0, null, TODAY)).isEqualTo(1);
    }

    @Test
    void 연속_3의_배수마다_한_단계_자라고_4에서_멈춘다() {
        assertThat(BirdGrowth.levelAfterAttending(1, 2, 3)).isEqualTo(1);
        assertThat(BirdGrowth.levelAfterAttending(1, 3, 3)).isEqualTo(2);
        assertThat(BirdGrowth.levelAfterAttending(2, 6, 3)).isEqualTo(3);
        assertThat(BirdGrowth.levelAfterAttending(4, 15, 3)).isEqualTo(4);
    }

    @Test
    void 빠진_날이_3일까지는_그대로_넘으면_하루_한_단계씩_작아진다() {
        // 마지막 출석 10/9 → 10/10·11·12 빠짐(3일) → 오늘 그대로
        assertThat(BirdGrowth.currentLevel(4, TODAY.minusDays(4), TODAY, 3)).isEqualTo(4);
        // 4일 빠짐 → 한 단계
        assertThat(BirdGrowth.currentLevel(4, TODAY.minusDays(5), TODAY, 3)).isEqualTo(3);
        assertThat(BirdGrowth.currentLevel(4, TODAY.minusDays(7), TODAY, 3)).isEqualTo(1);
        // 가장 작은 크기 밑으로는 안 내려감
        assertThat(BirdGrowth.currentLevel(4, TODAY.minusDays(400), TODAY, 3)).isEqualTo(1);
        assertThat(BirdGrowth.currentLevel(3, null, TODAY, 3)).isEqualTo(3);
    }

    @Test
    void 연속_출석은_어제나_오늘_출석했을_때만_보인다() {
        assertThat(BirdGrowth.currentStreak(5, TODAY, TODAY)).isEqualTo(5);
        assertThat(BirdGrowth.currentStreak(5, TODAY.minusDays(1), TODAY)).isEqualTo(5);
        assertThat(BirdGrowth.currentStreak(5, TODAY.minusDays(2), TODAY)).isZero();
        assertThat(BirdGrowth.currentStreak(0, null, TODAY)).isZero();
    }

    @Test
    void 다음_성장까지_남은_날() {
        assertThat(BirdGrowth.daysToGrow(1, 0, 3)).isEqualTo(3);
        assertThat(BirdGrowth.daysToGrow(1, 2, 3)).isEqualTo(1);
        assertThat(BirdGrowth.daysToGrow(2, 3, 3)).isEqualTo(3);
        assertThat(BirdGrowth.daysToGrow(4, 2, 3)).isZero();
    }

    @Test
    void 크기_이름() {
        assertThat(BirdGrowth.levelName(1)).isEqualTo("아기 새");
        assertThat(BirdGrowth.levelName(4)).isEqualTo("어른 새");
    }
}
