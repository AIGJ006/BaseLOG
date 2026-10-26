package com.team.blog.shared.web.shell;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.ClassPathResource;

/** 화면 주소의 검색 엔진 메타 (구글 "표준이 없는 중복 페이지" 정리). */
class ScreenPageMetaTest {

    private static final String BASE = "https://blog.example.com";

    private static final String SITE_NEWS =
            "{\"notices\":[{\"id\":\"2026-10-12-open\",\"title\":\"사이트를 열었어요\",\"date\":\"2026-10-12\"}],"
                    + "\"releases\":[{\"id\":\"v1.5.3\",\"title\":\"BaseLOG 1.5.2 배포 이후 수정사항\",\"date\":\"2026-10-21\"},"
                    + "{\"id\":\"v1.0.0\",\"title\":\"\",\"date\":\"\"}]}";

    private static ScreenPageMeta meta(String json) {
        return new ScreenPageMeta(
                BASE, new ByteArrayResource(json.getBytes(StandardCharsets.UTF_8)));
    }

    @Test
    void 약관과_목록_화면은_제목과_자기_주소_canonical() {
        LinkPreviewMeta terms = meta(SITE_NEWS).forPath("/terms");

        assertThat(terms.title()).isEqualTo("이용약관 - BaseLOG");
        assertThat(terms.canonicalUrl()).isEqualTo(BASE + "/terms");
        assertThat(terms.noindex()).isFalse();
        assertThat(meta(SITE_NEWS).forPath("/releases").canonicalUrl())
                .isEqualTo(BASE + "/releases");
    }

    @Test
    void 공지와_업데이트_소식_글은_글마다_제목() {
        ScreenPageMeta meta = meta(SITE_NEWS);

        LinkPreviewMeta release = meta.forPath("/releases/v1.5.3");
        assertThat(release.title()).isEqualTo("BaseLOG 1.5.2 배포 이후 수정사항");
        assertThat(release.description()).isEqualTo("BaseLOG 업데이트 소식 (2026-10-21)");
        assertThat(release.canonicalUrl()).isEqualTo(BASE + "/releases/v1.5.3");
        assertThat(release.noindex()).isFalse();

        LinkPreviewMeta notice = meta.forPath("/notices/2026-10-12-open");
        assertThat(notice.title()).isEqualTo("사이트를 열었어요 - BaseLOG");
        assertThat(notice.canonicalUrl()).isEqualTo(BASE + "/notices/2026-10-12-open");
    }

    @Test
    void 없는_글_제목_없는_글_그_밖의_화면은_noindex() {
        ScreenPageMeta meta = meta(SITE_NEWS);

        for (String path :
                new String[] {
                    "/releases/v9.9.9", "/releases/v1.0.0", "/login", "/signup", "/없는화면"
                }) {
            LinkPreviewMeta result = meta.forPath(path);
            assertThat(result.noindex()).as(path).isTrue();
            assertThat(result.canonicalUrl()).as(path).isNull();
            assertThat(result.title()).as(path).isNull();
        }
    }

    @Test
    void 목록_파일이_없거나_깨져도_뜬다() {
        assertThat(
                        new ScreenPageMeta(BASE, new ClassPathResource("no/such/site-news.json"))
                                .forPath("/releases/v1.5.3")
                                .noindex())
                .isTrue();
        assertThat(meta("{not json").forPath("/terms").noindex()).isFalse();
    }
}
