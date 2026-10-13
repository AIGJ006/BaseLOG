package com.team.blog.nest.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import com.team.blog.nest.application.NestPointService;
import com.team.blog.nest.application.NestWithdrawalPurgeStep;
import com.team.blog.nest.support.NestApi;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.PostFixtures;
import java.time.Duration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.support.TransactionTemplate;

/** 활동 포인트와 하루 상한·중복 막기, 탈퇴 정리 (021 FR-020~FR-025·FR-040). */
class NestPointIT extends IntegrationTestBase {

    @Autowired private NestPointService points;
    @Autowired private NestWithdrawalPurgeStep purgeStep;
    @Autowired private TransactionTemplate tx;

    private long author;

    @BeforeEach
    void setUp() {
        author = members().member().create();
    }

    private int balance(long memberId) {
        return jdbc.queryForObject(
                "SELECT COALESCE(sum(amount), 0) FROM nest_point WHERE member_id = ?",
                Integer.class,
                memberId);
    }

    private int rows(String reason) {
        return jdbc.queryForObject(
                "SELECT count(*) FROM nest_point WHERE member_id = ? AND reason = ?",
                Integer.class,
                author,
                reason);
    }

    @Test
    void 글은_건당_20점_하루_3건까지_같은_글은_한_번() {
        assertThat(points.grantPost(author, 1)).isTrue();
        assertThat(points.grantPost(author, 1)).isFalse();
        assertThat(points.grantPost(author, 2)).isTrue();
        assertThat(points.grantPost(author, 3)).isTrue();
        assertThat(points.grantPost(author, 4)).isFalse();
        assertThat(rows("POST")).isEqualTo(3);
        assertThat(balance(author)).isEqualTo(60);
    }

    @Test
    void 댓글은_건당_5점_하루_5건까지() {
        for (long id = 1; id <= 6; id++) {
            points.grantComment(author, id);
        }
        assertThat(rows("COMMENT")).isEqualTo(5);
        assertThat(balance(author)).isEqualTo(25);
    }

    @Test
    void 좋아요는_다른_사람만_같은_사람은_한_번_하루_20건까지() {
        assertThat(points.grantLike(author, 10, author)).as("내 글에 단 내 좋아요").isFalse();
        assertThat(points.grantLike(author, 10, 500)).isTrue();
        assertThat(points.grantLike(author, 10, 500)).as("취소했다 다시 누름").isFalse();
        for (long liker = 501; liker < 530; liker++) {
            points.grantLike(author, 10, liker);
        }
        assertThat(rows("LIKE_RECEIVED")).isEqualTo(20);
        assertThat(balance(author)).isEqualTo(40);
    }

    @Test
    void 실제로_좋아요를_누르면_글쓴이가_포인트를_받는다() throws Exception {
        long post = new PostFixtures(jdbc).create(author, PostFixtures.State.PUBLISHED_PUBLIC);
        long liker = members().member().create();
        NestApi api = new NestApi(mockMvc);
        assertThat(NestApi.status(api.like(TestLogin.loginAs(mockMvc, liker), post)))
                .isBetween(200, 204);

        await().atMost(Duration.ofSeconds(5)).until(() -> rows("LIKE_RECEIVED") == 1);
        assertThat(balance(author)).isEqualTo(2);
    }

    @Test
    void 탈퇴_정리는_둥지와_기록과_물건을_모두_지운다() {
        points.grantPost(author, 1);
        jdbc.update("INSERT INTO nest_item (member_id, item_code) VALUES (?, 'acc-hat')", author);
        long other = members().member().create();
        points.grantPost(other, 2);

        tx.executeWithoutResult(s -> purgeStep.purge(author));
        tx.executeWithoutResult(s -> purgeStep.purge(author));

        assertThat(purgeStep.order()).isEqualTo(25);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM nest WHERE member_id = ?",
                                Integer.class,
                                author))
                .isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM nest_item WHERE member_id = ?",
                                Integer.class,
                                author))
                .isZero();
        assertThat(balance(author)).isZero();
        assertThat(balance(other)).isEqualTo(20);
    }
}
