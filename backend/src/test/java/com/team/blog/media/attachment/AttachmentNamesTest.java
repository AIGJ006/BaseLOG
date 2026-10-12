package com.team.blog.media.attachment;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class AttachmentNamesTest {

    @Test
    void 경로와_제어_문자와_앞뒤_점을_뺀다() {
        assertThat(AttachmentNames.clean("C:\\Users\\me\\보고서.pdf")).isEqualTo("보고서.pdf");
        assertThat(AttachmentNames.clean("a/b/c.txt")).isEqualTo("c.txt");
        assertThat(AttachmentNames.clean(" ..hidden.txt. ")).isEqualTo("hidden.txt");
        assertThat(AttachmentNames.clean("a\u0000b\u202E.txt")).isEqualTo("ab.txt");
        assertThat(AttachmentNames.clean(null)).isEmpty();
        assertThat(AttachmentNames.clean("...")).isEmpty();
    }

    @Test
    void 긴_이름은_확장자를_살려_255자로_자른다() {
        String name = "가".repeat(300) + ".pdf";
        String cleaned = AttachmentNames.clean(name);
        assertThat(cleaned.codePointCount(0, cleaned.length())).isEqualTo(255);
        assertThat(cleaned).endsWith(".pdf");
    }

    @Test
    void 확장자는_소문자로_마지막_점_뒤만() {
        assertThat(AttachmentNames.extension("a.tar.GZ")).isEqualTo("gz");
        assertThat(AttachmentNames.extension("README")).isEmpty();
        assertThat(AttachmentNames.extension("name.")).isEmpty();
    }
}
