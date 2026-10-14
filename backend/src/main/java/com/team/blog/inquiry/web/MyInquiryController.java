package com.team.blog.inquiry.web;

import com.team.blog.inquiry.application.InquiryService;
import com.team.blog.inquiry.application.InquiryView;
import com.team.blog.shared.security.LoginRequired;
import com.team.blog.shared.security.Viewer;
import com.team.blog.shared.web.CacheControlPolicy;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 문의·신고 보내기와 내가 보낸 문의 (023). 현재 사용자는 세션의 {@link Viewer}로만 받는다. CSRF는 001 공통 설정({@code
 * X-XSRF-TOKEN}). 응답은 항상 {@code Cache-Control: private, no-store}.
 */
@RestController
public class MyInquiryController {

    /**
     * @param category {@code BUG}·{@code ACCOUNT}·{@code USER_REPORT}·{@code OTHER}
     * @param content 내용 (2000자 이하)
     * @param targetHandle 사용자 신고일 때 신고할 사람 블로그 주소 (선택)
     * @param imageId 사진 업로드 API로 올린 사진 번호 (선택)
     */
    public record CreateRequest(
            Object category, Object content, Object targetHandle, Object imageId) {}

    private final InquiryService inquiryService;

    public MyInquiryController(InquiryService inquiryService) {
        this.inquiryService = inquiryService;
    }

    @LoginRequired
    @PostMapping("/api/me/inquiries")
    public ResponseEntity<InquiryView> create(
            Viewer viewer, @RequestBody(required = false) CreateRequest request) {
        CreateRequest body = request == null ? new CreateRequest(null, null, null, null) : request;
        InquiryView created =
                inquiryService.create(
                        viewer,
                        body.category(),
                        body.content(),
                        body.targetHandle(),
                        body.imageId());
        return noStore(HttpStatus.CREATED, created);
    }

    @LoginRequired
    @GetMapping("/api/me/inquiries")
    public ResponseEntity<InquiryView.MyList> mine(Viewer viewer) {
        return noStore(HttpStatus.OK, inquiryService.mine(viewer));
    }

    static <T> ResponseEntity<T> noStore(HttpStatus status, T body) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_STORE)
                .body(body);
    }
}
