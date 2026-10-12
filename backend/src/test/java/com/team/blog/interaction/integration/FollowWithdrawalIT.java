package com.team.blog.interaction.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.team.blog.interaction.application.FollowPurgeService;
import com.team.blog.interaction.application.FollowWithdrawalPurgeStep;
import com.team.blog.interaction.support.FollowFixtures;
import com.team.blog.shared.application.withdraw.WithdrawalPurgeStep;
import com.team.blog.support.IntegrationTestBase;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.IllegalTransactionStateException;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 탈퇴하는 회원의 팔로우 행 정리 (010 T039 US4 SC-008). 020에서 팔로우를 빼 화면·API는 {@code follow}를 쓰지 않지만 남은 행이 익명 처리를
 * 막지 않게 015 단계 order 65({@link FollowWithdrawalPurgeStep})가 {@link
 * FollowPurgeService#purgeByMember}로 계속 지운다.
 */
class FollowWithdrawalIT extends IntegrationTestBase {

    @Autowired FollowPurgeService purgeService;
    @Autowired TransactionTemplate tx;
    @Autowired List<WithdrawalPurgeStep> steps;

    private long a;
    private long b;
    private long other;

    @BeforeEach
    void setUp() {
        a = members().member().handle("leaver_a").create();
        b = members().member().handle("stay_b").create();
        other = members().member().create();
        FollowFixtures f = new FollowFixtures(jdbc);
        f.follow(a, b);
        f.follow(b, a);
        f.follow(other, b);
        f.follow(b, other);
    }

    @Test
    void US4_3_정리하면_양방향_0행_남의_관계는_그대로() {
        Integer deleted = tx.execute(status -> purgeService.purgeByMember(a));

        assertThat(deleted).isEqualTo(2);
        FollowFixtures f = new FollowFixtures(jdbc);
        assertThat(f.rowsOf(a)).isZero();
        assertThat(f.rows(other, b)).isEqualTo(1);
        assertThat(f.rows(b, other)).isEqualTo(1);
        Integer again = tx.execute(status -> purgeService.purgeByMember(a));
        assertThat(again).as("멱등").isZero();
    }

    @Test
    void 트랜잭션_밖_호출이면_예외() {
        assertThatThrownBy(() -> purgeService.purgeByMember(a))
                .isInstanceOf(IllegalTransactionStateException.class);
        assertThat(new FollowFixtures(jdbc).rowsOf(a)).isEqualTo(2);
    }

    @Test
    void 정리_단계_order_65는_010_FollowWithdrawalPurgeStep_하나다() {
        List<WithdrawalPurgeStep> at65 = steps.stream().filter(step -> step.order() == 65).toList();
        assertThat(at65).hasSize(1);
        assertThat(at65.get(0)).isInstanceOf(FollowWithdrawalPurgeStep.class);
        assertThat(FollowPurgeService.WITHDRAWAL_PURGE_ORDER).isEqualTo(65);

        tx.executeWithoutResult(status -> at65.get(0).purge(a));
        assertThat(new FollowFixtures(jdbc).rowsOf(a)).isZero();
        assertThatThrownBy(() -> at65.get(0).purge(b))
                .as("MANDATORY")
                .isInstanceOf(IllegalTransactionStateException.class);
    }
}
