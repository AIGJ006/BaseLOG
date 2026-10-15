package com.team.blog.account.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.account.application.ProfileUpdate;
import com.team.blog.account.web.dto.ProfileUpdateRequest;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

/** 프로필 저장 본문 읽기: 보내지 않은 칸과 {@code null}을 구분한다 (FR-047, 025 둥지 배너). */
class ProfileUpdateRequestTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private static ProfileUpdate read(String body) {
        return JSON.readValue(body, ProfileUpdateRequest.class).toCommand();
    }

    @Test
    void 배너_번호를_보내면_붙이기() {
        ProfileUpdate update = read("{\"bannerImageId\":42}");

        assertThat(update.bannerImagePresent()).isTrue();
        assertThat(update.bannerImageId()).isEqualTo(42L);
        assertThat(update.profileImagePresent()).isFalse();
        assertThat(update.isEmpty()).isFalse();
    }

    @Test
    void 배너_null은_기본_배경으로() {
        ProfileUpdate update = read("{\"bannerImageId\":null}");

        assertThat(update.bannerImagePresent()).isTrue();
        assertThat(update.bannerImageId()).isNull();
        assertThat(update.isEmpty()).isFalse();
    }

    @Test
    void 배너_칸을_보내지_않으면_그대로() {
        ProfileUpdate update = read("{\"bio\":\"안녕하세요\",\"profileImageId\":7}");

        assertThat(update.bannerImagePresent()).isFalse();
        assertThat(update.bannerImageId()).isNull();
        assertThat(update.profileImageId()).isEqualTo(7L);
    }

    @Test
    void 아는_칸이_하나도_없으면_빈_요청() {
        assertThat(read("{\"memberId\":1}").isEmpty()).isTrue();
    }
}
