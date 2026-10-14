package com.team.blog.spellcheck.application;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.springframework.stereotype.Component;

/**
 * AI가 돌려준 고칠 곳 거르기 (022 spec R4). 모델이 지어낸 것·뜻 없는 것을 버린다.
 *
 * <ul>
 *   <li>틀린 말이 비었거나 보낸 글에 그대로 없으면 버린다 (화면이 찾아 밑줄을 그을 수 없다)
 *   <li>고친 말이 비었거나 틀린 말과 같으면 버린다. 너무 긴 것(틀린 말 {@value #MAX_ORIGINAL}자, 고친 말 {@value
 *       #MAX_SUGGESTION}자 넘음)도 버린다
 *   <li>같은 틀린 말은 처음 것 하나만, 최대 {@code maxIssues}개
 *   <li>이유는 {@value #MAX_REASON}자까지 자른다
 * </ul>
 */
@Component
public class SpellIssueFilter {

    static final int MAX_ORIGINAL = 60;
    static final int MAX_SUGGESTION = 80;
    static final int MAX_REASON = 100;

    public List<SpellIssue> accepted(List<SpellIssue> raw, String sentText, int maxIssues) {
        List<SpellIssue> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (SpellIssue issue : raw) {
            if (out.size() >= maxIssues) {
                break;
            }
            String original = nfc(issue.original()).strip();
            String suggestion = nfc(issue.suggestion()).strip();
            if (original.isEmpty()
                    || suggestion.isEmpty()
                    || original.equals(suggestion)
                    || SpellInputCleaner.length(original) > MAX_ORIGINAL
                    || SpellInputCleaner.length(suggestion) > MAX_SUGGESTION
                    || !sentText.contains(original)
                    || !seen.add(original)) {
                continue;
            }
            out.add(new SpellIssue(original, suggestion, cut(nfc(issue.reason()).strip())));
        }
        return out;
    }

    private static String nfc(String s) {
        return s == null ? "" : Normalizer.normalize(s, Normalizer.Form.NFC);
    }

    private static String cut(String reason) {
        if (SpellInputCleaner.length(reason) <= MAX_REASON) {
            return reason;
        }
        return reason.substring(0, reason.offsetByCodePoints(0, MAX_REASON));
    }
}
