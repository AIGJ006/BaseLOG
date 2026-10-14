package com.team.blog.spellcheck.application;

import com.team.blog.shared.error.ApiException;
import java.util.List;
import java.util.Map;

/**
 * 503 {@code AI_UNAVAILABLE} + {@code details {reason}}. 원인 예외는 붙이지 않는다 — 외부 응답 본문·입력이 원인 메시지에 들어
 * 있을 수 있다(013 R11과 같음).
 */
public class SpellCheckUnavailableException extends ApiException {

    static final String NOT_PUBLIC_MESSAGE = "비공개·친구 공개 글은 지금 검사할 수 없어요";

    private final SpellCheckUnavailableReason reason;

    public SpellCheckUnavailableException(SpellCheckUnavailableReason reason) {
        super(
                SpellCheckReasonCode.AI_UNAVAILABLE,
                reason == SpellCheckUnavailableReason.NOT_PUBLIC
                        ? NOT_PUBLIC_MESSAGE
                        : SpellCheckReasonCode.AI_UNAVAILABLE.defaultMessage(),
                List.of(),
                Map.of("reason", reason.name()),
                Map.of());
        this.reason = reason;
    }

    public SpellCheckUnavailableReason reason() {
        return reason;
    }
}
