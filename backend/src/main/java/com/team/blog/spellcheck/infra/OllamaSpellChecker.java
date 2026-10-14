package com.team.blog.spellcheck.infra;

import com.team.blog.spellcheck.application.SpellCheckInput;
import com.team.blog.spellcheck.application.SpellCheckProperties;
import com.team.blog.spellcheck.application.SpellChecker;
import com.team.blog.spellcheck.application.SpellOutcome;
import com.team.blog.tag.application.suggest.FailureKind;
import com.team.blog.tag.application.suggest.Provider;
import com.team.blog.tag.application.suggest.TagSuggestProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 자체 AI Ollama {@code /api/chat}로 맞춤법 검사 (022 spec 공급자 §4). 주소·모델·스레드 수는 013 {@code
 * blog.ai.tag-suggest.ollama}를 쓴다. 동시 처리 제한은 라우터가 이 앞에서 한다.
 */
public class OllamaSpellChecker implements SpellChecker {

    private static final Logger log = LoggerFactory.getLogger(OllamaSpellChecker.class);

    private final RestClient client;
    private final TagSuggestProperties.Ollama settings;
    private final SpellCheckProperties.Ollama limits;
    private final JsonMapper json;

    public OllamaSpellChecker(
            RestClient client,
            TagSuggestProperties.Ollama settings,
            SpellCheckProperties.Ollama limits,
            JsonMapper json) {
        this.client = client;
        this.settings = settings;
        this.limits = limits;
        this.json = json;
    }

    @Override
    public Provider provider() {
        return Provider.OLLAMA;
    }

    @Override
    public boolean isConfigured() {
        return settings.enabled();
    }

    @Override
    public SpellOutcome check(SpellCheckInput input) {
        String body = json.writeValueAsString(requestBody(input));
        try {
            return client.post()
                    .uri("/api/chat")
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(body)
                    .exchange(
                            (request, response) ->
                                    interpret(
                                            response.getStatusCode().value(),
                                            SpellResponses.readBody(response.getBody())));
        } catch (RestClientException e) {
            FailureKind kind = SpellResponses.failureOf(e);
            log.warn("ollama 맞춤법 검사 실패: {}", kind);
            return new SpellOutcome.Failed(kind);
        }
    }

    ObjectNode requestBody(SpellCheckInput input) {
        ObjectNode root = json.createObjectNode();
        root.put("model", settings.model());
        root.put("stream", false);
        root.set("format", SpellResponses.issuesSchema(json, false, input.maxIssues()));
        ObjectNode options = root.putObject("options");
        options.put("num_thread", settings.numThread());
        options.put("num_predict", limits.maxOutputTokens());
        options.put("temperature", 0.0);
        var messages = root.putArray("messages");
        messages.addObject().put("role", "system").put("content", SpellPrompt.system(input));
        messages.addObject().put("role", "user").put("content", SpellPrompt.user(input));
        return root;
    }

    private SpellOutcome interpret(int status, String body) {
        if (status == 200) {
            return SpellResponses.readJson(json, body)
                    .map(root -> root.path("message").path("content"))
                    .filter(JsonNode::isString)
                    .flatMap(text -> SpellResponses.parseIssues(json, text.asString()))
                    .<SpellOutcome>map(SpellOutcome.Success::new)
                    .orElseGet(() -> new SpellOutcome.Failed(FailureKind.MALFORMED));
        }
        log.warn("ollama 맞춤법 검사 오류 응답: status={}", status);
        return new SpellOutcome.Failed(FailureKind.SERVER_ERROR);
    }
}
