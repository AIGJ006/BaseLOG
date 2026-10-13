package com.team.blog.nest.domain;

import com.team.blog.shared.error.ReasonCode;
import org.springframework.http.HttpStatus;

/** 둥지 이유 코드 (021 contracts). 문구 끝에 마침표를 붙이지 않는다(README "정해진 것"). */
public enum NestReasonCode implements ReasonCode {
    /** 상점에 없는 물건 코드. */
    NEST_ITEM_UNKNOWN(HttpStatus.BAD_REQUEST, "없는 꾸미기 물건이에요"),
    /** 이미 가진 물건(값 0인 기본 물건 포함)을 다시 사기. */
    NEST_ITEM_ALREADY_OWNED(HttpStatus.CONFLICT, "이미 가진 물건이에요"),
    /** 포인트가 값보다 적음. */
    NEST_POINTS_NOT_ENOUGH(HttpStatus.CONFLICT, "포인트가 모자라요"),
    /** 사지 않은 물건 장착, 또는 칸에 맞지 않는 종류(배경 칸에 장식 등). */
    NEST_ITEM_NOT_OWNED(HttpStatus.BAD_REQUEST, "가진 물건만 장착할 수 있어요");

    private final HttpStatus status;
    private final String defaultMessage;

    NestReasonCode(HttpStatus status, String defaultMessage) {
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
