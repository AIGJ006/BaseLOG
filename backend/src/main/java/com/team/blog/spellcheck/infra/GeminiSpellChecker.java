package com.team.blog.spellcheck.infra;

import com.team.blog.spellcheck.application.SpellCheckInput;
import com.team.blog.spellcheck.application.SpellCheckProperties;
import com.team.blog.spellcheck.application.SpellChecker;
import com.team.blog.spellcheck.application.SpellOutcome;
import com.team.blog.tag.application.suggest.FailureKind;
import com.team.blog.tag.application.suggest.Provider;
import com.team.blog.tag.application.suggest.QuotaKind;
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
 * Google Gemini {@code generateContent}로 맞춤법 검사 (022 spec 공급자 §3). 주소·모델·키는 013 {@code
 * blog.ai.tag-suggest.gemini}를 쓴다. 키는 {@code x-goog-api-key} 헤더로만 보내고, 출력은 {@code responseSchema}로
 * 강제한다. 응답 본문은 해석만 하고 어떤 로그에도 넣지 않는다.
 */
public class GeminiSpellChecker implements SpellChecker {

    private static final Logger log = LoggerFactory.getLogger(GeminiSpellChecker.class);

    private final RestClient client;
    private final TagSuggestProperties.Gemini settings;
    private final SpellCheckProperties.Gemini limits;
    private final JsonMapper json;

    public GeminiSpellChecker(
            RestClient client,
            TagSuggestProperties.Gemini settings,
            SpellCheckProperties.Gemini limits,
            JsonMapper json) {
        this.client = client;
        this.settings = settings;
        this.limits = limits;
        this.json = json;
    }

    @Override
    public Provider provider() {
        return Provider.GEMINI;
    }

    @Override
    public boolean isConfigured() {
        return settings.hasApiKey();
    }

    @Override
    public SpellOutcome check(SpellCheckInput input) {
        String body = json.writeValueAsString(requestBody(input));
        try {
            return client.post()
                    .uri("/v1beta/models/{model}:generateContent", settings.model())
                    .header("x-goog-api-key", settings.apiKey())
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
            log.warn("gemini 맞춤법 검사 실패: {}", kind);
            return new SpellOutcome.Failed(kind);
        }
    }

    ObjectNode requestBody(SpellCheckInput input) {
        ObjectNode root = json.createObjectNode();
        root.putObject("systemInstruction")
                .putArray("parts")
                .addObject()
                .put("text", SpellPrompt.system(input));
        ObjectNode content = root.putArray("contents").addObject();
        content.put("role", "user");
        content.putArray("parts").addObject().put("text", SpellPrompt.user(input));
        ObjectNode config = root.putObject("generationConfig");
        config.put("responseMimeType", "application/json");
        config.set("responseSchema", SpellResponses.issuesSchema(json, true, input.maxIssues()));
        config.put("maxOutputTokens", limits.maxOutputTokens());
        config.put("temperature", 0.0);
        return root;
    }

    private SpellOutcome interpret(int status, String body) {
        if (status == 200) {
            return SpellResponses.readJson(json, body)
                    .map(root -> root.path("candidates").path(0).path("content").path("parts"))
                    .map(parts -> parts.path(0).path("text"))
                    .filter(JsonNode::isString)
                    .flatMap(text -> SpellResponses.parseIssues(json, text.asString()))
                    .<SpellOutcome>map(SpellOutcome.Success::new)
                    .orElseGet(() -> new SpellOutcome.Failed(FailureKind.MALFORMED));
        }
        if (status == 429) {
            return new SpellOutcome.QuotaExceeded(quotaKind(body));
        }
        if (status == 400 || status == 401 || status == 403) {
            log.error("gemini 맞춤법 검사 요청 거부: status={}", status);
        } else {
            log.warn("gemini 맞춤법 검사 오류 응답: status={}", status);
        }
        return new SpellOutcome.Failed(FailureKind.SERVER_ERROR);
    }

    /** 013 {@code GeminiTagSuggester}와 같은 방식으로 하루·분당 한도를 가른다. */
    private QuotaKind quotaKind(String body) {
        JsonNode details =
                SpellResponses.readJson(json, body)
                        .map(r -> r.path("error").path("details"))
                        .orElse(null);
        if (details == null || !details.isArray()) {
            return QuotaKind.UNKNOWN;
        }
        boolean perMinute = false;
        for (JsonNode detail : details) {
            if (!detail.path("@type").asString("").endsWith("QuotaFailure")) {
                continue;
            }
            for (JsonNode violation : detail.path("violations")) {
                String quotaId = violation.path("quotaId").asString("");
                if (quotaId.contains("PerDay")) {
                    return QuotaKind.PER_DAY;
                }
                if (quotaId.contains("PerMinute")) {
                    perMinute = true;
                }
            }
        }
        return perMinute ? QuotaKind.PER_MINUTE : QuotaKind.UNKNOWN;
    }
}
