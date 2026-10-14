package com.team.blog.spellcheck.infra;

import com.team.blog.spellcheck.application.SpellCheckProperties;
import com.team.blog.tag.application.suggest.TagSuggestProperties;
import com.team.blog.tag.infra.ai.AiClientConfig;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.json.JsonMapper;

/**
 * 맞춤법 검사 공급자 (022 spec R2). 013과 같은 방식으로 공급자마다 {@code RestClient}를 새로 만든다 — 응답 시간 제한만 검사용({@code
 * blog.ai.spell-check.*.timeout})으로 길게 둔다.
 */
@Configuration(proxyBeanMethods = false)
public class SpellCheckClientConfig {

    @Bean
    GeminiSpellChecker geminiSpellChecker(
            TagSuggestProperties ai, SpellCheckProperties spell, JsonMapper json) {
        TagSuggestProperties.Gemini g = ai.gemini();
        return new GeminiSpellChecker(
                AiClientConfig.restClient(
                        g.baseUrl(), g.connectTimeout(), spell.gemini().timeout()),
                g,
                spell.gemini(),
                json);
    }

    @Bean
    OllamaSpellChecker ollamaSpellChecker(
            TagSuggestProperties ai, SpellCheckProperties spell, JsonMapper json) {
        TagSuggestProperties.Ollama o = ai.ollama();
        return new OllamaSpellChecker(
                AiClientConfig.restClient(
                        o.baseUrl(), o.connectTimeout(), spell.ollama().timeout()),
                o,
                spell.ollama(),
                json);
    }
}
