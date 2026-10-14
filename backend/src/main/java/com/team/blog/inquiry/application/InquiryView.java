package com.team.blog.inquiry.application;

import com.team.blog.inquiry.domain.InquiryCategory;
import com.team.blog.inquiry.domain.InquiryStatus;
import java.time.Instant;
import java.util.List;

/**
 * 내가 보낸 문의 한 건 (023). 답한 관리자는 알려 주지 않는다.
 *
 * @param targetHandle 사용자 신고일 때 적은 블로그 주소 (없으면 {@code null})
 * @param imageUrl 붙인 사진 주소 (없거나 지워졌으면 {@code null})
 * @param answer 답변 (접수 상태면 {@code null})
 */
public record InquiryView(
        long id,
        InquiryCategory category,
        String content,
        String targetHandle,
        String imageUrl,
        InquiryStatus status,
        String answer,
        Instant answeredAt,
        Instant createdAt) {

    /** 내가 보낸 문의 목록 (새것부터). */
    public record MyList(List<InquiryView> items) {}
}
