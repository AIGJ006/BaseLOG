package com.team.blog.spellcheck.application;

/**
 * 고칠 곳 하나 (022 spec 데이터 §1).
 *
 * @param original 글에 있는 그대로의 틀린 말 (어절 단위)
 * @param suggestion 고친 말
 * @param reason 짧은 이유 (없으면 빈 문자열)
 */
public record SpellIssue(String original, String suggestion, String reason) {
    public SpellIssue {
        reason = reason == null ? "" : reason;
    }
}
