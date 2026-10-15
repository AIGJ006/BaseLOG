package com.team.blog.account.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.account.application.BannerColors;
import org.junit.jupiter.api.Test;

/** 025 배너 색: {@code #rrggbb}만 받고 소문자로 맞춘다. */
class BannerColorsTest {

    @Test
    void 여섯_자리_16진수만_받고_소문자로() {
        assertThat(BannerColors.normalize("#6AFF1E")).isEqualTo("#6aff1e");
        assertThat(BannerColors.normalize(" #2f7d3a ")).isEqualTo("#2f7d3a");
    }

    @Test
    void 틀린_값은_null() {
        assertThat(BannerColors.normalize("red")).isNull();
        assertThat(BannerColors.normalize("#fff")).isNull();
        assertThat(BannerColors.normalize("6aff1e")).isNull();
        assertThat(BannerColors.normalize("#6aff1e00")).isNull();
        assertThat(BannerColors.normalize("#gggggg")).isNull();
        assertThat(BannerColors.normalize(null)).isNull();
    }
}
