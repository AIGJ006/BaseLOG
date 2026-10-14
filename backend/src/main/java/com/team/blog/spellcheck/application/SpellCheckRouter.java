package com.team.blog.spellcheck.application;

import com.team.blog.post.application.OwnedPost;
import com.team.blog.post.domain.Visibility;
import com.team.blog.tag.application.suggest.FailureKind;
import com.team.blog.tag.application.suggest.Provider;
import com.team.blog.tag.application.suggest.ProviderState;
import java.time.Instant;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 공급자 고르기와 전환 (022 spec R2). 013 {@code TagSuggesterRouter}와 같은 규칙이고, Gemini 상태(하루 한도·쉬는 시간)는 013
 * {@link ProviderState}를 함께 쓴다 — 같은 키라 한도가 하나다.
 *
 * <ul>
 *   <li>공개 범위가 PUBLIC이 아니면 자체 AI만 (외부로 보내지 않는다, 013 FR-030)
 *   <li>Gemini 키 없음·소진·쉬는 중이면 자체 AI
 *   <li>Gemini 429는 같은 요청을 자체 AI로 다시 보내고, 시간 초과·서버 오류는 쉬게 하고 이번 요청은 실패로 끝낸다
 * </ul>
 */
@Component
public class SpellCheckRouter {

    /**
     * 호출 결과.
     *
     * @param provider 마지막으로 부른 공급자 (아무도 부르지 않았으면 {@code null})
     * @param truncated 그 공급자 최대 길이로 본문을 잘랐는가
     * @param sentText 그 공급자에 보낸 글
     * @param outcome 결과
     */
    public record Routed(
            Provider provider, boolean truncated, String sentText, SpellOutcome outcome) {}

    private final Map<Provider, SpellChecker> checkers = new EnumMap<>(Provider.class);
    private final ProviderState state;
    private final SpellCheckProperties properties;

    /** {@code checkers}는 Spring이 순서대로 넣은 목록이다 — 공급자마다 처음 것을 쓴다. */
    public SpellCheckRouter(
            List<SpellChecker> checkers, ProviderState state, SpellCheckProperties properties) {
        for (SpellChecker c : checkers) {
            this.checkers.putIfAbsent(c.provider(), c);
        }
        this.state = state;
        this.properties = properties;
    }

    /**
     * 지금 고를 공급자.
     *
     * @return 없으면 빈 값
     */
    public Optional<Provider> choose(OwnedPost post, Instant now) {
        Optional<Provider> fallback =
                configured(Provider.OLLAMA) ? Optional.of(Provider.OLLAMA) : Optional.empty();
        if (post.visibility() != Visibility.PUBLIC) {
            return fallback;
        }
        if (!configured(Provider.GEMINI) || state.geminiBlocked(now)) {
            return fallback;
        }
        return Optional.of(Provider.GEMINI);
    }

    /** 고른 공급자로 부른다. */
    public Routed check(Provider provider, String text, Instant now) {
        return provider == Provider.GEMINI ? callGemini(text, now) : callOllama(text);
    }

    private Routed callGemini(String text, Instant now) {
        String sent = SpellInputCleaner.truncate(text, properties.gemini().maxInputChars());
        boolean truncated = sent.length() < text.length();
        state.countGeminiCall(now);
        SpellOutcome outcome = checkers.get(Provider.GEMINI).check(input(sent));
        switch (outcome) {
            case SpellOutcome.Success s -> {
                state.geminiSucceeded(now);
                return new Routed(Provider.GEMINI, truncated, sent, s);
            }
            case SpellOutcome.QuotaExceeded q -> {
                switch (q.kind()) {
                    case PER_DAY -> state.exhaust(now);
                    case PER_MINUTE -> state.cooldown();
                    case UNKNOWN -> state.unknown429(now);
                }
                return callOllama(text);
            }
            case SpellOutcome.Failed f -> {
                if (f.kind() != FailureKind.MALFORMED) {
                    state.cooldown();
                }
                return new Routed(Provider.GEMINI, truncated, sent, f);
            }
            case SpellOutcome.Busy b -> {
                return new Routed(Provider.GEMINI, truncated, sent, b);
            }
        }
    }

    private Routed callOllama(String text) {
        if (!configured(Provider.OLLAMA)) {
            return new Routed(null, false, "", new SpellOutcome.Failed(FailureKind.SERVER_ERROR));
        }
        String sent = SpellInputCleaner.truncate(text, properties.ollama().maxInputChars());
        boolean truncated = sent.length() < text.length();
        if (!state.acquireOllama()) {
            return new Routed(Provider.OLLAMA, truncated, sent, new SpellOutcome.Busy());
        }
        try {
            return new Routed(
                    Provider.OLLAMA,
                    truncated,
                    sent,
                    checkers.get(Provider.OLLAMA).check(input(sent)));
        } finally {
            state.releaseOllama();
        }
    }

    private SpellCheckInput input(String sent) {
        return new SpellCheckInput(sent, properties.maxIssues());
    }

    private boolean configured(Provider provider) {
        SpellChecker checker = checkers.get(provider);
        return checker != null && checker.isConfigured();
    }
}
