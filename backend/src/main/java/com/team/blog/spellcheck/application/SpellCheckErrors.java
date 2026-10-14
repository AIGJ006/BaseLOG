package com.team.blog.spellcheck.application;

import com.team.blog.shared.error.ApiException;
import com.team.blog.shared.error.BusinessRuleException;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** 맞춤법 검사의 4xx 예외들. */
public final class SpellCheckErrors {

    private SpellCheckErrors() {}

    /** 409 {@code AI_CONSENT_REQUIRED} + {@code details {version}} — 화면이 동의 창을 띄운다. */
    public static class ConsentRequired extends BusinessRuleException {
        public ConsentRequired(String currentVersion) {
            super(SpellCheckReasonCode.AI_CONSENT_REQUIRED, Map.of("version", currentVersion));
        }
    }

    /** 422 {@code CONTENT_TOO_SHORT} + {@code details {minChars, length}}. AI를 부르지 않는다. */
    public static class TooShort extends BusinessRuleException {
        public TooShort(int minChars, int length) {
            super(SpellCheckReasonCode.CONTENT_TOO_SHORT, details(minChars, length));
        }

        private static Map<String, Object> details(int minChars, int length) {
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("minChars", minChars);
            details.put("length", length);
            return details;
        }
    }

    /**
     * 429 {@code AI_DAILY_LIMIT} + {@code details {resetAt}} + {@code Retry-After}(그때까지 초, 최소 1).
     */
    public static class DailyLimit extends ApiException {
        public DailyLimit(Instant now, Instant resetAt) {
            super(
                    SpellCheckReasonCode.AI_DAILY_LIMIT,
                    SpellCheckReasonCode.AI_DAILY_LIMIT.defaultMessage(),
                    List.of(),
                    Map.of("resetAt", resetAt.toString()),
                    Map.of(
                            "Retry-After",
                            String.valueOf(
                                    Math.max(1, Duration.between(now, resetAt).toSeconds()))));
        }
    }
}
