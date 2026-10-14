package com.team.blog.spellcheck.web.dto;

import com.team.blog.spellcheck.application.SpellCheckResult;
import com.team.blog.spellcheck.application.SpellIssue;
import java.util.List;

/** {@code POST /api/posts/{postId}/spell-check} 200 (022 spec API). */
public record SpellCheckResponse(
        List<Issue> issues, String provider, boolean truncated, int remainingToday) {

    /** 고칠 곳 하나. */
    public record Issue(String original, String suggestion, String reason) {
        static Issue from(SpellIssue issue) {
            return new Issue(issue.original(), issue.suggestion(), issue.reason());
        }
    }

    public static SpellCheckResponse from(SpellCheckResult result) {
        return new SpellCheckResponse(
                result.issues().stream().map(Issue::from).toList(),
                result.provider() == null ? null : result.provider().name(),
                result.truncated(),
                result.remainingToday());
    }
}
