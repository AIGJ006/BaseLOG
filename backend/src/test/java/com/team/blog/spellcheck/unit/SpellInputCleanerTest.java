package com.team.blog.spellcheck.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.spellcheck.application.SpellInputCleaner;
import org.junit.jupiter.api.Test;

/** 검사할 본문 정리 (022 spec R3). */
class SpellInputCleanerTest {

    private final SpellInputCleaner cleaner = new SpellInputCleaner();

    @Test
    void 코드_블록과_인라인_코드를_버린다() {
        String md =
                """
                앞 문장이에요.
                ```java
                int 되요 = 1;
                ```
                `되요` 뒤 문장이에요.
                """;
        String text = cleaner.clean(md);
        assertThat(text).doesNotContain("int").doesNotContain("되요");
        assertThat(text).contains("앞 문장이에요.").contains("뒤 문장이에요.");
    }

    @Test
    void 닫히지_않은_코드_블록은_끝까지_버린다() {
        assertThat(cleaner.clean("앞이에요\n```\n코드 되요")).isEqualTo("앞이에요");
    }

    @Test
    void 링크는_글자만_사진과_주소와_HTML은_버린다() {
        String text =
                cleaner.clean(
                        "[블로그 주소](https://a.test) 와 ![사진 설명](/img.png) 그리고 https://b.test/x <b>굵게</b>");
        assertThat(text).isEqualTo("블로그 주소 와   그리고    굵게");
    }

    @Test
    void 빈_줄_여럿은_하나로() {
        assertThat(cleaner.clean("첫 줄\n\n\n\n둘째 줄")).isEqualTo("첫 줄\n\n둘째 줄");
    }

    @Test
    void 아주_긴_빈_줄_묶음도_스택_넘침_없이() {
        String md = "첫 줄" + "\n ".repeat(100_000) + "\n둘째 줄";
        assertThat(cleaner.clean(md)).isEqualTo("첫 줄\n\n둘째 줄");
    }

    @Test
    void 비었으면_빈_문자열() {
        assertThat(cleaner.clean(null)).isEmpty();
        assertThat(cleaner.clean("  \n ")).isEmpty();
    }

    @Test
    void 자르기는_뒤쪽_줄바꿈에서() {
        String text = "가".repeat(8) + "\n" + "나".repeat(8);
        assertThat(SpellInputCleaner.truncate(text, 12)).isEqualTo("가".repeat(8));
        assertThat(SpellInputCleaner.truncate(text, 100)).isEqualTo(text);
        // 줄바꿈이 앞쪽 절반보다 앞이면 그냥 자른다
        assertThat(SpellInputCleaner.truncate("가\n" + "나".repeat(20), 10))
                .isEqualTo("가\n" + "나".repeat(8));
    }
}
