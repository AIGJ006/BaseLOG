/**
 * inquiry 모듈: 문의·신고 (023, 2026-10-14 민서 요청). 회원이 {@code /support}에서 버그 신고·계정 문의·사용자 신고·기타를 보내고,
 * 관리자가 {@code /admin/inquiries}에서 답한다. 답하면 상태가 "답변 완료"가 되고 {@code InquiryAnswered} 이벤트로 011 알림이 🔔를
 * 띄운다.
 *
 * <p>{@code inquiry} 테이블은 이 모듈만 읽고 쓴다. 회원 표시 정보는 account {@code MemberQueryService}, 사진은 media
 * {@code InquiryImageService}, 관리자 확인은 014 {@code ModerationAccess}로만 쓴다(헌법 II).
 */
package com.team.blog.inquiry;
