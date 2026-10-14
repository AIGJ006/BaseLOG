package com.team.blog.inquiry.domain;

/** 문의 상태 (V12 {@code ck_inquiry_status}). */
public enum InquiryStatus {
    /** 접수 — 아직 답이 없다. */
    RECEIVED,
    /** 답변 완료. */
    ANSWERED
}
