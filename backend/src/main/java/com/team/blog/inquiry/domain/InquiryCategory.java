package com.team.blog.inquiry.domain;

/** 문의 종류 (V12 {@code ck_inquiry_category}). */
public enum InquiryCategory {
    /** 버그 신고. */
    BUG,
    /** 계정 문의. */
    ACCOUNT,
    /** 사용자 신고 — 신고할 사람 블로그 주소를 함께 적을 수 있다. */
    USER_REPORT,
    /** 기타. */
    OTHER
}
