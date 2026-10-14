package com.team.blog.spellcheck.application;

import com.team.blog.tag.application.suggest.Provider;
import java.util.List;

/**
 * 검사 결과.
 *
 * @param issues 고칠 곳 (없으면 빈 목록)
 * @param provider 검사한 공급자
 * @param truncated 본문이 길어 앞부분만 검사했는가
 * @param remainingToday 오늘 남은 검사 수
 */
public record SpellCheckResult(
        List<SpellIssue> issues, Provider provider, boolean truncated, int remainingToday) {
    public SpellCheckResult {
        issues = List.copyOf(issues);
    }
}
