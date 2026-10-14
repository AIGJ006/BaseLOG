package com.team.blog.spellcheck.application;

import com.team.blog.tag.application.suggest.FailureKind;
import com.team.blog.tag.application.suggest.QuotaKind;
import java.util.List;
import java.util.Objects;

/** 공급자 호출 결과. 예외를 던지지 않고 값으로 돌려준다(013 {@code SuggestOutcome}과 같은 꼴). */
public sealed interface SpellOutcome {

    /** AI가 답을 줌 — 걸러내기 전 고칠 곳. */
    record Success(List<SpellIssue> issues) implements SpellOutcome {
        public Success {
            issues = List.copyOf(issues);
        }
    }

    /** Gemini 429. */
    record QuotaExceeded(QuotaKind kind) implements SpellOutcome {
        public QuotaExceeded {
            Objects.requireNonNull(kind, "kind");
        }
    }

    /** 실패. */
    record Failed(FailureKind kind) implements SpellOutcome {
        public Failed {
            Objects.requireNonNull(kind, "kind");
        }
    }

    /** 자체 AI 동시 처리 초과. */
    record Busy() implements SpellOutcome {}
}
