package com.team.blog.spellcheck.application;

import com.team.blog.tag.application.suggest.Provider;

/**
 * 맞춤법 검사 공급자. 구현은 {@code spellcheck.infra}의 {@code GeminiSpellChecker}·{@code OllamaSpellChecker}.
 * 같은 공급자 Bean이 여럿이면 순서가 가장 앞선 것을 쓴다(시험의 가짜 공급자).
 */
public interface SpellChecker {

    Provider provider();

    /** 설정상 쓸 수 있는가 (Gemini 키 없음·Ollama 꺼짐이면 {@code false}). */
    boolean isConfigured();

    /** 예외를 던지지 않는다 — 실패도 {@link SpellOutcome}으로 돌려준다. */
    SpellOutcome check(SpellCheckInput input);
}
