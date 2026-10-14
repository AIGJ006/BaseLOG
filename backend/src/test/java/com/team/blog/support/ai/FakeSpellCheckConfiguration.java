package com.team.blog.support.ai;

import com.team.blog.tag.application.suggest.Provider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

/**
 * 시험 프로필의 가짜 맞춤법 검사 공급자 (022). {@link FakeAiConfiguration}과 같은 이유로 컴포넌트 스캔으로 넣는다 — 새 컨텍스트를 만들지 않는다.
 * 실제 공급자 Bean은 순서가 뒤라 고르지 않는다(외부로 나가는 요청 없음).
 */
@Profile("test")
@Configuration(proxyBeanMethods = false)
public class FakeSpellCheckConfiguration {

    @Bean
    FakeSpell fakeSpell() {
        return new FakeSpell(
                new FakeSpellChecker(Provider.GEMINI), new FakeSpellChecker(Provider.OLLAMA));
    }

    @Bean
    FakeSpellChecker fakeGeminiSpellChecker(FakeSpell fakeSpell) {
        return fakeSpell.gemini();
    }

    @Bean
    FakeSpellChecker fakeOllamaSpellChecker(FakeSpell fakeSpell) {
        return fakeSpell.ollama();
    }

    /** 두 가짜 공급자 묶음. */
    public record FakeSpell(FakeSpellChecker gemini, FakeSpellChecker ollama) {

        public void reset() {
            gemini.reset();
            ollama.reset();
        }

        public int totalCalls() {
            return gemini.calls() + ollama.calls();
        }
    }
}
