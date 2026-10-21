package com.team.blog.discovery.application;

import com.team.blog.account.application.BlogOwner;
import com.team.blog.post.infra.PostDetailRow;
import com.team.blog.shared.web.shell.SpaShellRenderer;
import org.owasp.html.HtmlPolicyBuilder;
import org.owasp.html.PolicyFactory;
import org.springframework.stereotype.Component;

/**
 * 검색 로봇용 본문 — 첫 응답 {@code <div id="root">} 안에 넣는다 ({@link SpaShellRenderer#render(
 * com.team.blog.shared.web.shell.LinkPreviewMeta, String)}).
 *
 * <p>화면은 React가 그리므로 자바스크립트를 실행하지 않는 검색 로봇(네이버 등)은 빈 {@code <div id="root"></div>}만 본다. 공개 글의
 * 제목·작성자·본문 글자, 둥지의 이름·소개를 HTML로 미리 넣어 둔다. 사람에게는 {@code visually-hidden}(base.css)으로 보이지 않고, React가
 * 뜨면 {@code createRoot}가 이 자리를 새로 그린다 — 화면에 깜빡이지 않는다.
 *
 * <p>본문은 발행 때 정화된 HTML에서 글 구조 태그만 남긴다(사진·링크·속성 없음 — 보이지 않는 자리에서 사진을 내려받지 않게). 공개 글({@code
 * PUBLIC}·숨김 아님)에만 쓴다.
 */
@Component
public class CrawlerPreview {

    static final String OPEN = "<div class=\"visually-hidden\">";
    static final String CLOSE = "</div>";

    private final ReadingProperties properties;

    public CrawlerPreview(ReadingProperties properties) {
        this.properties = properties;
    }

    private static final PolicyFactory TEXT_ONLY =
            new HtmlPolicyBuilder()
                    .allowElements(
                            "p",
                            "br",
                            "h2",
                            "h3",
                            "h4",
                            "h5",
                            "h6",
                            "ul",
                            "ol",
                            "li",
                            "blockquote",
                            "pre",
                            "code",
                            "strong",
                            "em",
                            "b",
                            "i",
                            "table",
                            "thead",
                            "tbody",
                            "tr",
                            "th",
                            "td")
                    .toFactory();

    /** 공개 글. */
    public String forPublicPost(PostDetailRow row) {
        String body = row.contentHtml() == null ? "" : TEXT_ONLY.sanitize(row.contentHtml());
        return OPEN
                + "<article><h1>"
                + SpaShellRenderer.escape(row.title())
                + "</h1><p>"
                + SpaShellRenderer.escape(row.nickname())
                + "</p>"
                + body
                + "</article>"
                + CLOSE;
    }

    /** 둥지 (블로그) 첫 화면. 소개는 미리보기 설명과 같이 앞 {@code blog.seo.description-length}자만. */
    public String forBlog(BlogOwner owner) {
        String shortBio =
                LinkPreviewMetaFactory.shorten(owner.bio(), properties.seo().descriptionLength());
        String bio = shortBio == null ? "" : "<p>" + SpaShellRenderer.escape(shortBio) + "</p>";
        return OPEN
                + "<h1>"
                + SpaShellRenderer.escape(owner.nickname() + " (@" + owner.handle() + ")")
                + "</h1>"
                + bio
                + CLOSE;
    }

    /** 사이트 첫 화면 — 설정의 사이트 설명({@code seo.site-description})을 쓴다. */
    public String forHome() {
        return forHome(properties.seo().siteDescription());
    }

    /** 사이트 첫 화면. */
    public String forHome(String description) {
        return OPEN
                + "<h1>"
                + SpaShellRenderer.SITE_NAME
                + "</h1><p>"
                + SpaShellRenderer.escape(description)
                + "</p>"
                + CLOSE;
    }
}
