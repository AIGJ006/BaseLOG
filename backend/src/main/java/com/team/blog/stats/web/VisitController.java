package com.team.blog.stats.web;

import com.team.blog.interaction.application.ViewProperties;
import com.team.blog.interaction.application.VisitorKeyResolver;
import com.team.blog.interaction.web.VisitorIdCookieFilter;
import com.team.blog.shared.security.Viewer;
import com.team.blog.shared.web.CacheControlPolicy;
import com.team.blog.shared.web.ClientIp;
import com.team.blog.stats.application.VisitRecordService;
import com.team.blog.stats.application.VisitRecordService.VisitRequest;
import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 방문 기록 (024). 비회원도 부를 수 있고, 셌든 뺐든 건너뛰었든 같은 {@code 204}(본문 없음, {@code no-store})다. 같은 방문자 1분 30번
 * 초과는 429. CSRF는 001 공통 설정.
 *
 * <p>비회원에게 형식이 맞는 {@code vid} 쿠키가 없으면 여기서 새로 주고 그 값으로 센다 — 첫 방문(해시 키)과 다음 방문(쿠키 키)이 다른 방문자로 세어지지
 * 않게. 쿠키 속성은 009 {@link VisitorIdCookieFilter}와 같다.
 */
@RestController
public class VisitController {

    private final VisitRecordService service;
    private final ViewProperties viewProperties;
    private final boolean secureCookie;

    public VisitController(
            VisitRecordService service,
            ViewProperties viewProperties,
            @Value("${server.servlet.session.cookie.secure:true}") boolean secureCookie) {
        this.service = service;
        this.viewProperties = viewProperties;
        this.secureCookie = secureCookie;
    }

    @PostMapping("/api/visits")
    public ResponseEntity<Void> record(
            Viewer viewer,
            @CookieValue(name = VisitorIdCookieFilter.COOKIE_NAME, required = false) String vid,
            HttpServletRequest request) {
        ResponseEntity.HeadersBuilder<?> response =
                ResponseEntity.noContent()
                        .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_STORE);
        String visitorId = vid;
        if (!viewer.isAuthenticated() && !VisitorKeyResolver.isValidVid(vid)) {
            visitorId = UUID.randomUUID().toString();
            response.header(
                    HttpHeaders.SET_COOKIE,
                    ResponseCookie.from(VisitorIdCookieFilter.COOKIE_NAME, visitorId)
                            .maxAge(viewProperties.visitorCookieMaxAge())
                            .path("/")
                            .httpOnly(true)
                            .secure(secureCookie)
                            .sameSite("Lax")
                            .build()
                            .toString());
        }
        service.record(
                viewer,
                new VisitRequest(
                        request.getHeader(HttpHeaders.USER_AGENT),
                        request.getHeader("Sec-Purpose"),
                        request.getHeader("Purpose"),
                        visitorId,
                        ClientIp.of(request)));
        return response.build();
    }
}
