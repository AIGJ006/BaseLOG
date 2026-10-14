package com.team.blog.spellcheck.application;

/** 503 {@code AI_UNAVAILABLE}의 {@code details.reason} (022 spec 데이터 §3). */
public enum SpellCheckUnavailableReason {
    /** 기능 꺼짐 ({@code blog.ai.spell-check.enabled = false}). */
    DISABLED,
    /** 공급자 시간 초과·서버 오류·형식 깨짐, 쓸 수 있는 공급자 없음. */
    FAILED,
    /** 자체 AI 동시 처리 초과. */
    BUSY,
    /** 비공개·친구 공개 글인데 자체 AI가 꺼져 있음 — 외부로 보내지 않는다. */
    NOT_PUBLIC,
    /** Redis 장애·메모리 부족. */
    STORE_UNAVAILABLE
}
