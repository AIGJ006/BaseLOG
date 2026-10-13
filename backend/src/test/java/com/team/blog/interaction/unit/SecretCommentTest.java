package com.team.blog.interaction.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.interaction.domain.SecretComment;
import org.junit.jupiter.api.Test;

/** 비밀 댓글을 읽을 수 있는 사람 (007 비밀 댓글). 회원 번호: 작성자 1, 글 주인 2, 최상위 작성자 3, 답글 대상 4, 남 9. */
class SecretCommentTest {

    @Test
    void 공개_댓글은_비회원도_읽는다() {
        assertThat(SecretComment.readable(false, null, 1, 2, null, null)).isTrue();
    }

    @Test
    void 비밀_최상위는_작성자와_글_주인만() {
        assertThat(SecretComment.readable(true, 1L, 1, 2, null, null)).isTrue();
        assertThat(SecretComment.readable(true, 2L, 1, 2, null, null)).isTrue();
        assertThat(SecretComment.readable(true, 9L, 1, 2, null, null)).isFalse();
        assertThat(SecretComment.readable(true, null, 1, 2, null, null)).isFalse();
    }

    @Test
    void 비밀_답글은_최상위_작성자와_답글_대상도() {
        assertThat(SecretComment.readable(true, 3L, 1, 2, 3L, 4L)).isTrue();
        assertThat(SecretComment.readable(true, 4L, 1, 2, 3L, 4L)).isTrue();
        assertThat(SecretComment.readable(true, 9L, 1, 2, 3L, 4L)).isFalse();
    }
}
