package com.team.blog.spellcheck.application;

import com.team.blog.shared.error.ReasonCode;
import org.springframework.http.HttpStatus;

/** 맞춤법 검사 이유 코드 (022 spec API). 코드 이름은 013 태그 추천과 같다 — 화면이 같은 방식으로 다룬다. 문구 끝에 마침표를 붙이지 않는다. */
public enum SpellCheckReasonCode implements ReasonCode {
    /** 동의 행 없음·버전 다름. {@code details {version}}. */
    AI_CONSENT_REQUIRED(HttpStatus.CONFLICT, "맞춤법 검사를 쓰려면 AI 동의가 필요해요"),
    /** 검사할 글자가 너무 적음. {@code details {minChars, length}}. */
    CONTENT_TOO_SHORT(HttpStatus.UNPROCESSABLE_CONTENT, "검사할 내용이 없어요"),
    /** 오늘 회원 한도를 다 씀. {@code details {resetAt}} + {@code Retry-After}. */
    AI_DAILY_LIMIT(HttpStatus.TOO_MANY_REQUESTS, "오늘 맞춤법 검사를 모두 썼어요. 내일 다시 써 보세요"),
    /** 검사할 수 없음. {@code details {reason}} ({@link SpellCheckUnavailableReason}). */
    AI_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "지금은 검사할 수 없어요. 잠시 뒤 다시 시도해 주세요");

    private final HttpStatus status;
    private final String defaultMessage;

    SpellCheckReasonCode(HttpStatus status, String defaultMessage) {
        this.status = status;
        this.defaultMessage = defaultMessage;
    }

    @Override
    public String code() {
        return name();
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String defaultMessage() {
        return defaultMessage;
    }
}
