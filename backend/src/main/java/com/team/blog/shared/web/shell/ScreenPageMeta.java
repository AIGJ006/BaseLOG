package com.team.blog.shared.web.shell;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * {@code SpaForwardingController}가 그리는 화면 주소의 검색 엔진 메타 (구글 "사용자가 선택한 표준이 없는 중복 페이지" 정리).
 *
 * <p>이 화면들은 모두 같은 React 셸이라 메타가 없으면 구글이 한 페이지의 중복으로 본다.
 *
 * <ul>
 *   <li>색인할 화면 — 이용약관·개인정보 처리방침·공지·업데이트 소식(목록과 글): 화면마다 {@code <title>}·설명·자기 주소 canonical.
 *   <li>그 밖(로그인·가입·비밀번호 찾기·설정 등, 없는 주소의 화면 404 포함): {@code noindex}.
 * </ul>
 *
 * <p>공지·업데이트 소식 글의 제목은 화면 빌드가 내는 {@code classpath:static/site-news.json}(vite {@code
 * siteNewsIndex})에서 읽는다. 목록에 없는 글 번호는 화면이 "없는 글"을 보여 주므로 {@code noindex}. 파일이 없으면(시험·개발) 글 주소는 모두
 * {@code noindex}다.
 */
@Component
public class ScreenPageMeta {

    private static final Logger log = LoggerFactory.getLogger(ScreenPageMeta.class);

    private record Page(String title, String description) {}

    private static final Map<String, Page> FIXED =
            Map.of(
                    "/terms", new Page("이용약관 - BaseLOG", "BaseLOG 서비스 이용약관"),
                    "/privacy", new Page("개인정보 처리방침 - BaseLOG", "BaseLOG 개인정보 처리방침"),
                    "/notices", new Page("공지 - BaseLOG", "BaseLOG 공지 목록"),
                    "/releases", new Page("업데이트 소식 - BaseLOG", "BaseLOG 업데이트 소식 목록"));

    private final String baseUrl;
    private final Map<String, Page> notes;

    public ScreenPageMeta(
            @Value("${blog.site.base-url}") String baseUrl,
            @Value("classpath:static/site-news.json") Resource siteNews) {
        this.baseUrl = baseUrl;
        this.notes = readNotes(siteNews);
    }

    /** {@code path}는 쿼리 문자열 없는 요청 경로. */
    public LinkPreviewMeta forPath(String path) {
        Page page = FIXED.get(path);
        if (page == null) {
            page = notes.get(path);
        }
        if (page == null) {
            return new LinkPreviewMeta(null, null, null, null, null, null, null, null, null, true);
        }
        return new LinkPreviewMeta(
                page.title(),
                page.description(),
                baseUrl + path,
                "website",
                page.title(),
                page.description(),
                null,
                null,
                null,
                false);
    }

    private static Map<String, Page> readNotes(Resource resource) {
        Map<String, Page> pages = new HashMap<>();
        if (resource == null || !resource.exists()) {
            log.info("site-news.json이 없어 공지·업데이트 소식 글 주소는 noindex로 둡니다");
            return pages;
        }
        try (InputStream in = resource.getInputStream()) {
            JsonNode root = JsonMapper.builder().build().readTree(in);
            add(pages, root.path("notices"), "/notices/", "BaseLOG 공지");
            add(pages, root.path("releases"), "/releases/", "BaseLOG 업데이트 소식");
        } catch (IOException | RuntimeException e) {
            log.warn("site-news.json을 읽지 못했습니다: {}", e.getMessage());
        }
        return pages;
    }

    private static void add(Map<String, Page> pages, JsonNode entries, String prefix, String kind) {
        for (JsonNode entry : entries) {
            String id = entry.path("id").asString("");
            String title = entry.path("title").asString("");
            if (id.isEmpty() || title.isEmpty()) {
                continue;
            }
            String date = entry.path("date").asString("");
            String fullTitle = title.contains("BaseLOG") ? title : title + " - BaseLOG";
            String description = date.isEmpty() ? kind : kind + " (" + date + ")";
            pages.put(prefix + id, new Page(fullTitle, description));
        }
    }
}
