package com.team.blog.post.domain;

import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.ReasonCode;
import org.springframework.http.HttpStatus;

/** 030 공동 작업자 칸 오류 ({@code errors[].code}, 응답은 400 {@code VALIDATION_FAILED}). */
public enum CollaboratorReasonCode implements ReasonCode {
    /** 공동 작업자가 {@link #MAX}명보다 많음 (field {@code handles}). */
    TOO_MANY_COLLABORATORS(HttpStatus.BAD_REQUEST, "공동 작업자는 3명까지 고를 수 있어요"),
    /** 친구가 아니거나 나 자신·없는 회원 (field {@code handles}). */
    COLLABORATOR_NOT_FRIEND(HttpStatus.BAD_REQUEST, "친구만 공동 작업자로 고를 수 있어요"),
    /** 나만 보기 글에 공동 작업자를 고름 (field {@code handles}, 2026-10-16 민서). */
    PRIVATE_POST_COLLABORATORS(HttpStatus.BAD_REQUEST, "나만 보기 글에는 공동 작업자를 고를 수 없어요"),
    /** 공동 작업자가 있는 글을 나만 보기로 등록·변경 (field {@code visibility}). */
    COLLABORATOR_POST_PRIVATE(HttpStatus.BAD_REQUEST, "공동 작업자가 있는 글은 나만 보기로 할 수 없어요");

    /** 글 한 개의 공동 작업자 최대 수. */
    public static final int MAX = 3;

    private final HttpStatus status;
    private final String defaultMessage;

    CollaboratorReasonCode(HttpStatus status, String defaultMessage) {
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

    public FieldError fieldError(String field) {
        return new FieldError(field, code(), defaultMessage);
    }
}
