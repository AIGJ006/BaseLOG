package com.team.blog.shared.event;

import java.time.Instant;

/**
 * 관리자가 문의에 처음 답함 (023). 답을 고칠 때는 다시 발행하지 않는다. 구독: 011 문의한 회원에게 {@code INQUIRY_ANSWERED} 알림.
 *
 * @param inquiryId 문의 번호 ({@code inquiry.id})
 * @param memberId 문의한 회원
 */
public record InquiryAnswered(long inquiryId, long memberId, Instant answeredAt)
        implements DomainEvent {}
