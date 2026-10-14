package com.team.blog.spellcheck.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.spellcheck.application.SpellIssue;
import com.team.blog.spellcheck.application.SpellIssueFilter;
import java.util.List;
import org.junit.jupiter.api.Test;

/** AI 고칠 곳 거르기 (022 spec R4). */
class SpellIssueFilterTest {

    private static final String TEXT = "오늘은 할수있다고 생각했는데 안되요. 내일 봬요.";

    private final SpellIssueFilter filter = new SpellIssueFilter();

    @Test
    void 글에_없는_말_같은_말_빈_말_중복을_뺀다() {
        List<SpellIssue> raw =
                List.of(
                        new SpellIssue("할수있다고", "할 수 있다고", "띄어쓰기"),
                        new SpellIssue("없는말", "없는 말", ""),
                        new SpellIssue("봬요", "봬요", ""),
                        new SpellIssue(" ", "a", ""),
                        new SpellIssue("안되요", "", ""),
                        new SpellIssue(" 안되요 ", "안 돼요", null),
                        new SpellIssue("안되요", "안돼요", "중복"));
        assertThat(filter.accepted(raw, TEXT, 50))
                .containsExactly(
                        new SpellIssue("할수있다고", "할 수 있다고", "띄어쓰기"),
                        new SpellIssue("안되요", "안 돼요", ""));
    }

    @Test
    void 최대_개수와_긴_이유_자르기() {
        List<SpellIssue> raw =
                List.of(
                        new SpellIssue("할수있다고", "할 수 있다고", "가".repeat(150)),
                        new SpellIssue("안되요", "안 돼요", ""));
        List<SpellIssue> out = filter.accepted(raw, TEXT, 1);
        assertThat(out).hasSize(1);
        assertThat(out.get(0).reason()).hasSize(100);
    }

    @Test
    void 너무_긴_틀린_말은_뺀다() {
        String longText = "가".repeat(70);
        assertThat(filter.accepted(List.of(new SpellIssue(longText, "나", "")), longText, 50))
                .isEmpty();
    }
}
