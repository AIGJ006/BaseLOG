package com.team.blog.inquiry.web;

import com.team.blog.inquiry.application.AdminInquiryService;
import com.team.blog.inquiry.application.AdminInquiryView;
import com.team.blog.inquiry.domain.InquiryStatus;
import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.security.LoginRequired;
import com.team.blog.shared.security.Viewer;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 관리자 문의 API (023). {@code /api/admin/**}는 004 관리자 경로 규칙(비회원 401·일반 회원 404)이 먼저 막고, Service가 다시
 * 확인한다. 응답은 항상 {@code Cache-Control: private, no-store}.
 */
@RestController
public class AdminInquiryController {

    /**
     * @param answer 답변 (2000자 이하)
     */
    public record AnswerRequest(Object answer) {}

    private final AdminInquiryService service;

    public AdminInquiryController(AdminInquiryService service) {
        this.service = service;
    }

    /**
     * @param status {@code RECEIVED}·{@code ANSWERED} (없으면 전부)
     * @param before 이 번호보다 앞선 것부터 (숫자가 아니면 첫 쪽)
     */
    @LoginRequired
    @GetMapping("/api/admin/inquiries")
    public ResponseEntity<AdminInquiryView.Page> list(
            Viewer viewer,
            @RequestParam(name = "status", required = false) String status,
            @RequestParam(name = "before", required = false) String before) {
        return MyInquiryController.noStore(
                HttpStatus.OK, service.list(viewer, status(status), positiveOrNull(before)));
    }

    /** 답 저장 — 처음이면 답변 완료로 바꾸고 알림을 보낸다. 이미 답했으면 답만 고친다. */
    @LoginRequired
    @PutMapping("/api/admin/inquiries/{id}/answer")
    public ResponseEntity<AdminInquiryView> answer(
            Viewer viewer,
            @PathVariable("id") String id,
            @RequestBody(required = false) AnswerRequest request) {
        Object answer = request == null ? null : request.answer();
        return MyInquiryController.noStore(
                HttpStatus.OK, service.answer(viewer, pathId(id), answer));
    }

    /** {@link #answer}와 같다 (폼 전송용). */
    @LoginRequired
    @PostMapping("/api/admin/inquiries/{id}/answer")
    public ResponseEntity<AdminInquiryView> answerByPost(
            Viewer viewer,
            @PathVariable("id") String id,
            @RequestBody(required = false) AnswerRequest request) {
        return answer(viewer, id, request);
    }

    private static InquiryStatus status(String raw) {
        if (raw == null || raw.isEmpty()) {
            return null;
        }
        try {
            return InquiryStatus.valueOf(raw);
        } catch (IllegalArgumentException e) {
            throw new ValidationException(
                    List.of(new FieldError("status", "INVALID_VALUE", "입력한 내용을 확인해 주세요")));
        }
    }

    /** 숫자가 아니거나 1 미만이면 0 — 어떤 문의와도 맞지 않아 404가 된다. */
    static long pathId(String raw) {
        Long id = positiveOrNull(raw);
        return id == null ? 0 : id;
    }

    static Long positiveOrNull(String raw) {
        if (raw == null || !raw.matches("\\d{1,18}")) {
            return null;
        }
        long id = Long.parseLong(raw);
        return id >= 1 ? id : null;
    }
}
