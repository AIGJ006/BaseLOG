package com.team.blog.discovery.application;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.account.application.BlogOwner;
import com.team.blog.post.domain.PostStatus;
import com.team.blog.post.domain.Visibility;
import com.team.blog.post.infra.PostDetailRow;
import org.junit.jupiter.api.Test;

/** 검색 로봇용 본문 (검색 엔진 노출). */
class CrawlerPreviewTest {

    private final CrawlerPreview preview =
            new CrawlerPreview(
                    new ReadingProperties(
                            new ReadingProperties.List(9),
                            new ReadingProperties.Seo(10, "http://localhost/og.png", "설명"),
                            new ReadingProperties.Site("http://localhost")));

    @Test
    void 둥지는_이름과_소개를_이스케이프해_넣고_소개가_없으면_뺀다() {
        String html = preview.forBlog(new BlogOwner(1, "kim", "<김>", " 소개 & 글 ", null));

        assertThat(html)
                .isEqualTo(
                        "<div class=\"visually-hidden\"><h1>&lt;김&gt; (@kim)</h1><p>소개 &amp; 글</p></div>");
        assertThat(preview.forBlog(new BlogOwner(1, "kim", "김", "가나다라마바사아자차카타", null)))
                .isEqualTo(
                        "<div class=\"visually-hidden\"><h1>김 (@kim)</h1><p>가나다라마바사아자차</p></div>");
        assertThat(preview.forBlog(new BlogOwner(1, "kim", "김", " ", null)))
                .isEqualTo("<div class=\"visually-hidden\"><h1>김 (@kim)</h1></div>");
    }

    @Test
    void 첫_화면은_서비스_이름과_설명() {
        assertThat(preview.forHome("설명"))
                .isEqualTo("<div class=\"visually-hidden\"><h1>BaseLOG</h1><p>설명</p></div>");
    }

    @Test
    void 글_본문은_구조_태그와_글자만_남기고_사진_링크_속성은_뺀다() {
        String content =
                "<h2 id=\"a\">소제목</h2><p>본문 <a href=\"https://x.example\">링크</a>"
                        + "<img src=\"https://x.example/a.png\"></p><pre><code class=\"language-java\">int a;</code></pre>";

        String html = preview.forPublicPost(row("제목 <b>", content));

        assertThat(html)
                .isEqualTo(
                        "<div class=\"visually-hidden\"><article><h1>제목 &lt;b&gt;</h1><p>김민서</p>"
                                + "<h2>소제목</h2><p>본문 링크</p><pre><code>int a;</code></pre>"
                                + "</article></div>");
    }

    private static PostDetailRow row(String title, String contentHtml) {
        return new PostDetailRow(
                1,
                1,
                title,
                contentHtml,
                PostStatus.PUBLISHED,
                Visibility.PUBLIC,
                0,
                0,
                0,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "kim",
                "김민서",
                null,
                null,
                null,
                null,
                false);
    }
}
