package com.team.blog.inquiry.application;

import com.team.blog.account.application.policy.HandlePolicy;
import com.team.blog.inquiry.domain.InquiryCategory;
import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.ValidationException;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * 문의 입력 형식 검사 (023). 칸 오류는 모아서 한 번에 400 {@code VALIDATION_FAILED}로 돌려준다. 문구 끝에 마침표를 붙이지 않는다.
 *
 * <ul>
 *   <li>{@code category}: 필수, 네 종류 중 하나
 *   <li>{@code content}: 필수, 앞뒤 공백을 뺀 뒤 1~{@value #CONTENT_MAX_CHARS}자(코드 포인트)
 *   <li>{@code targetHandle}: 사용자 신고일 때만 저장한다(다른 종류면 버린다). 앞의 {@code @}·주소 앞부분을 떼고 소문자로 바꾼 뒤 블로그 주소
 *       형식이어야 한다. 비면 없음
 *   <li>{@code imageId}: 없거나 1 이상 정수
 * </ul>
 *
 * @param targetHandle 사용자 신고가 아니면 {@code null}
 * @param imageId 없으면 {@code null}
 */
public record InquiryInput(
        InquiryCategory category, String content, String targetHandle, Long imageId) {

    public static final int CONTENT_MAX_CHARS = 2000;
    public static final int ANSWER_MAX_CHARS = 2000;

    private static final String INVALID = "입력한 내용을 확인해 주세요";

    public static InquiryInput parse(
            Object rawCategory, Object rawContent, Object rawTargetHandle, Object rawImageId) {
        List<FieldError> errors = new ArrayList<>();
        InquiryCategory category = category(rawCategory, errors);
        String content = text("content", rawContent, CONTENT_MAX_CHARS, "내용", errors);
        String target = null;
        if (category == InquiryCategory.USER_REPORT) {
            target = handle(rawTargetHandle, errors);
        }
        Long imageId = null;
        if (rawImageId != null) {
            long id = positiveLong(rawImageId);
            if (id < 1) {
                errors.add(new FieldError("imageId", "INVALID_VALUE", INVALID));
            } else {
                imageId = id;
            }
        }
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
        return new InquiryInput(category, content, target, imageId);
    }

    /** 관리자 답변: 필수, 앞뒤 공백을 뺀 뒤 1~{@value #ANSWER_MAX_CHARS}자. */
    public static String parseAnswer(Object rawAnswer) {
        List<FieldError> errors = new ArrayList<>();
        String answer = text("answer", rawAnswer, ANSWER_MAX_CHARS, "답변", errors);
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
        return answer;
    }

    private static InquiryCategory category(Object raw, List<FieldError> errors) {
        if (raw == null) {
            errors.add(new FieldError("category", "REQUIRED", "종류를 골라 주세요"));
            return null;
        }
        if (raw instanceof String text) {
            try {
                return InquiryCategory.valueOf(text);
            } catch (IllegalArgumentException ignored) {
                // 아래 칸 오류
            }
        }
        errors.add(new FieldError("category", "INVALID_VALUE", INVALID));
        return null;
    }

    private static String text(
            String field, Object raw, int max, String label, List<FieldError> errors) {
        if (raw != null && !(raw instanceof String)) {
            errors.add(new FieldError(field, "INVALID_VALUE", INVALID));
            return null;
        }
        String trimmed = raw == null ? "" : ((String) raw).strip();
        if (trimmed.isEmpty()) {
            errors.add(new FieldError(field, "REQUIRED", label + "을 적어 주세요"));
            return null;
        }
        if (trimmed.codePointCount(0, trimmed.length()) > max) {
            errors.add(new FieldError(field, "TOO_LONG", label + "은 " + max + "자까지 쓸 수 있어요"));
            return null;
        }
        return trimmed;
    }

    /**
     * {@code @kim}·{@code kim}·{@code https://…/@kim}·{@code https://…/@kim/posts/1} → {@code kim}.
     */
    private static String handle(Object raw, List<FieldError> errors) {
        if (raw == null) {
            return null;
        }
        if (!(raw instanceof String text)) {
            errors.add(new FieldError("targetHandle", "INVALID_VALUE", INVALID));
            return null;
        }
        String value = text.strip();
        if (value.isEmpty()) {
            return null;
        }
        int at = value.lastIndexOf('@');
        if (at >= 0) {
            value = value.substring(at + 1);
        }
        int slash = value.indexOf('/');
        if (slash >= 0) {
            value = value.substring(0, slash);
        }
        value = value.toLowerCase(Locale.ROOT);
        if (!HandlePolicy.FORMAT.matcher(value).matches()) {
            errors.add(new FieldError("targetHandle", "INVALID_VALUE", "블로그 주소를 확인해 주세요"));
            return null;
        }
        return value;
    }

    private static long positiveLong(Object raw) {
        if (raw instanceof Integer || raw instanceof Long || raw instanceof Short) {
            return ((Number) raw).longValue();
        }
        if (raw instanceof BigInteger big) {
            return big.bitLength() < 63 ? big.longValue() : 0;
        }
        if (raw instanceof String text && text.matches("[0-9]{1,18}")) {
            return Long.parseLong(text);
        }
        return 0;
    }
}
