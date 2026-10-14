package com.team.blog.spellcheck.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.team.blog.spellcheck.application.SpellCheckInput;
import com.team.blog.spellcheck.application.SpellCheckProperties;
import com.team.blog.spellcheck.application.SpellIssue;
import com.team.blog.spellcheck.application.SpellOutcome;
import com.team.blog.tag.application.suggest.FailureKind;
import com.team.blog.tag.application.suggest.TagSuggestProperties;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Ollama 맞춤법 검사 클라이언트 (022 spec 공급자 §4). */
class OllamaSpellCheckerTest {

    private final JsonMapper json = JsonMapper.builder().build();
    private MockRestServiceServer server;
    private OllamaSpellChecker checker;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://ollama.test");
        server = MockRestServiceServer.bindTo(builder).build();
        checker =
                new OllamaSpellChecker(
                        builder.build(),
                        new TagSuggestProperties.Ollama(
                                true,
                                "http://ollama.test",
                                "qwen2.5:1.5b",
                                4,
                                Duration.ofSeconds(1),
                                Duration.ofSeconds(30),
                                2000,
                                1),
                        new SpellCheckProperties.Ollama(1500, Duration.ofSeconds(60), 1024),
                        json);
    }

    @Test
    void 스키마와_출력_길이를_보내고_내용을_읽는다() {
        String content = "{\"issues\":[{\"original\":\"할수있다\",\"suggestion\":\"할 수 있다\"}]}";
        server.expect(requestTo("http://ollama.test/api/chat"))
                .andExpect(jsonPath("$.stream").value(false))
                .andExpect(jsonPath("$.format.properties.issues.type").value("array"))
                .andExpect(jsonPath("$.options.num_predict").value(1024))
                .andExpect(jsonPath("$.messages[1].content").value("검사할 글:\n할수있다"))
                .andRespond(
                        withSuccess(
                                "{\"message\":{\"content\":"
                                        + json.writeValueAsString(content)
                                        + "}}",
                                MediaType.APPLICATION_JSON));
        assertThat(checker.check(new SpellCheckInput("할수있다", 50)))
                .isEqualTo(new SpellOutcome.Success(List.of(new SpellIssue("할수있다", "할 수 있다", ""))));
        server.verify();
    }

    @Test
    void JSON이_아니면_MALFORMED() {
        server.expect(requestTo("http://ollama.test/api/chat"))
                .andRespond(
                        withSuccess(
                                "{\"message\":{\"content\":\"아무 말\"}}",
                                MediaType.APPLICATION_JSON));
        assertThat(checker.check(new SpellCheckInput("할수있다", 50)))
                .isEqualTo(new SpellOutcome.Failed(FailureKind.MALFORMED));
    }
}
