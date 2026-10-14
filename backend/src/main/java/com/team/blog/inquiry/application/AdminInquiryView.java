package com.team.blog.inquiry.application;

import com.team.blog.inquiry.domain.InquiryCategory;
import com.team.blog.inquiry.domain.InquiryStatus;
import java.time.Instant;
import java.util.List;

/**
 * 관리자 문의 목록 한 건 (023). 보낸 회원을 함께 준다.
 *
 * @param member 보낸 회원. 탈퇴 유예·익명 처리면 {@code withdrawn = true}이고 익명 처리면 주소·닉네임이 {@code null}
 */
public record AdminInquiryView(
        long id,
        Member member,
        InquiryCategory category,
        String content,
        String targetHandle,
        String imageUrl,
        InquiryStatus status,
        String answer,
        Instant answeredAt,
        Instant createdAt) {

    public record Member(String handle, String nickname, boolean withdrawn) {}

    /**
     * 한 쪽.
     *
     * @param nextBefore 다음 쪽을 부를 때 {@code before}로 보낼 번호 (끝이면 {@code null})
     */
    public record Page(List<AdminInquiryView> items, Long nextBefore) {}
}
