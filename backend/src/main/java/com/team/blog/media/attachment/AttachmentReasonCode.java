package com.team.blog.media.attachment;

import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.ReasonCode;
import org.springframework.http.HttpStatus;

/** 첨부파일 이유 코드 (018 FR-003~FR-005). 문구 끝에 마침표를 붙이지 않는다. 칸 오류는 400 {@code VALIDATION_FAILED}에 담긴다. */
public enum AttachmentReasonCode implements ReasonCode {
    /** 칸 오류: 파일이 없거나 비어 있음. */
    ATTACHMENT_EMPTY(HttpStatus.BAD_REQUEST, "올릴 파일을 골라 주세요"),
    /** 칸 오류: 받지 않는 확장자. */
    ATTACHMENT_TYPE_NOT_ALLOWED(HttpStatus.BAD_REQUEST, "올릴 수 없는 형식의 파일이에요"),
    /** 칸 오류: 크기 한도(10MB) 초과. */
    ATTACHMENT_TOO_LARGE(HttpStatus.BAD_REQUEST, "첨부파일은 10MB까지 올릴 수 있어요"),
    /** 글 하나의 첨부 수 초과. {@code details: {maxPerPost}}. */
    ATTACHMENT_LIMIT_EXCEEDED(HttpStatus.CONFLICT, "첨부파일은 글 하나에 5개까지 올릴 수 있어요");

    private final HttpStatus status;
    private final String defaultMessage;

    AttachmentReasonCode(HttpStatus status, String defaultMessage) {
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

    /** 이 코드의 칸 오류. */
    public FieldError fieldError(String field) {
        return new FieldError(field, name(), defaultMessage);
    }
}
