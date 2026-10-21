package com.team.blog.discovery.web;

import com.team.blog.discovery.application.ReadingProperties;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /robots.txt} — 검색 로봇 안내 (검색 엔진 노출). 사이트 지도 주소({@code blog.site.base-url} + {@code
 * /sitemap.xml})를 알려 주고, 로그인해야 쓰는 화면만 막는다.
 *
 * <p>{@code /api/}는 막지 않는다 — 구글은 화면을 그릴 때 API 요청도 robots.txt를 따르므로, 막으면 글 내용이 빈 화면으로 수집된다. 비공개·친구
 * 공개 글은 로그인하지 않은 로봇에게 404라 따로 막을 것이 없다. 검색 결과({@code /search}, 둥지 안 {@code ?q=})는 화면 메타 {@code
 * noindex}가 맡는다.
 */
@RestController
public class RobotsController {

    /** 로그인해야 쓰는 화면 (앞부분이 같은 주소 모두). */
    static final List<String> DISALLOW =
            List.of(
                    "/admin",
                    "/settings",
                    "/write",
                    "/manage",
                    "/notifications",
                    "/friends",
                    "/nest",
                    "/support",
                    "/account",
                    "/reagree",
                    "/reset-password",
                    "/verify-email",
                    "/signup/social");

    private static final MediaType TEXT_UTF8 =
            new MediaType(MediaType.TEXT_PLAIN, StandardCharsets.UTF_8);

    private final ReadingProperties properties;

    public RobotsController(ReadingProperties properties) {
        this.properties = properties;
    }

    @GetMapping("/robots.txt")
    public ResponseEntity<String> robots() {
        StringBuilder body = new StringBuilder("User-agent: *\n");
        for (String path : DISALLOW) {
            body.append("Disallow: ").append(path).append('\n');
        }
        body.append("Allow: /\n\n");
        body.append("Sitemap: ").append(properties.site().baseUrl()).append("/sitemap.xml\n");
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=3600")
                .contentType(TEXT_UTF8)
                .body(body.toString());
    }
}
