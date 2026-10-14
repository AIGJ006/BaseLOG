package com.team.blog.spellcheck.infra;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.team.blog.spellcheck.application.SpellCheckInput;
import com.team.blog.spellcheck.application.SpellCheckProperties;
import com.team.blog.spellcheck.application.SpellIssue;
import com.team.blog.spellcheck.application.SpellOutcome;
import com.team.blog.tag.application.suggest.FailureKind;
import com.team.blog.tag.application.suggest.QuotaKind;
import com.team.blog.tag.application.suggest.TagSuggestProperties;
import java.net.SocketTimeoutException;
import java.time.Duration;
import java.time.ZoneId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** Gemini 맞춤법 검사 클라이언트 (022 spec 공급자 §3). 외부 응답은 MockRestServiceServer로 흉내 낸다. */
class GeminiSpellCheckerTest {

    static final String KEY = "test-gemini-key-not-real";
    static final String URL = "http://gemini.test/v1beta/models/gemini-flash-lite:generateContent";

    private final JsonMapper json = JsonMapper.builder().build();
    private MockRestServiceServer server;
    private GeminiSpellChecker checker;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://gemini.test");
        server = MockRestServiceServer.bindTo(builder).build();
        TagSuggestProperties.Gemini settings =
                new TagSuggestProperties.Gemini(
                        "http://gemini.test",
                        "gemini-flash-lite",
                        KEY,
                        450,
                        ZoneId.of("America/Los_Angeles"),
                        Duration.ofSeconds(1),
                        Duration.ofSeconds(10),
                        Duration.ofSeconds(60),
                        3,
                        8000);
        checker =
                new GeminiSpellChecker(
                        builder.build(),
                        settings,
                        new SpellCheckProperties.Gemini(5000, Duration.ofSeconds(30), 4096),
                        json);
    }

    private static SpellCheckInput input() {
        return new SpellCheckInput("오늘은 안되요", 50);
    }

    private static String success(String text) {
        return "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":"
                + JsonMapper.builder().build().writeValueAsString(text)
                + "}]}}]}";
    }

    @Test
    void 키는_헤더로_보내고_스키마를_강제한다() {
        server.expect(requestTo(URL))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", KEY))
                .andExpect(
                        jsonPath("$.generationConfig.responseMimeType").value("application/json"))
                .andExpect(
                        jsonPath("$.generationConfig.responseSchema.properties.issues.maxItems")
                                .value(50))
                .andExpect(jsonPath("$.generationConfig.maxOutputTokens").value(4096))
                .andExpect(jsonPath("$.contents[0].parts[0].text").value("검사할 글:\n오늘은 안되요"))
                .andRespond(
                        withSuccess(
                                success(
                                        "{\"issues\":[{\"original\":\"안되요\",\"suggestion\":\"안 돼요\",\"reason\":\"띄어쓰기\"}]}"),
                                MediaType.APPLICATION_JSON));

        SpellOutcome outcome = checker.check(input());

        assertThat(outcome)
                .isEqualTo(
                        new SpellOutcome.Success(
                                java.util.List.of(new SpellIssue("안되요", "안 돼요", "띄어쓰기"))));
        server.verify();
    }

    @Test
    void 빈_목록도_성공() {
        server.expect(requestTo(URL))
                .andRespond(withSuccess(success("{\"issues\":[]}"), MediaType.APPLICATION_JSON));
        assertThat(checker.check(input())).isEqualTo(new SpellOutcome.Success(java.util.List.of()));
    }

    @Test
    void 형식이_깨지면_MALFORMED() {
        server.expect(requestTo(URL))
                .andRespond(
                        withSuccess(success("{\"issues\":\"없음\"}"), MediaType.APPLICATION_JSON));
        assertThat(checker.check(input()))
                .isEqualTo(new SpellOutcome.Failed(FailureKind.MALFORMED));
    }

    @Test
    void 하루_한도_429() {
        server.expect(requestTo(URL))
                .andRespond(
                        withStatus(HttpStatus.TOO_MANY_REQUESTS)
                                .contentType(MediaType.APPLICATION_JSON)
                                .body(
                                        "{\"error\":{\"details\":[{\"@type\":\"type.googleapis.com/google.rpc.QuotaFailure\","
                                                + "\"violations\":[{\"quotaId\":\"GenerateRequestsPerDayPerProjectPerModel-FreeTier\"}]}]}}"));
        assertThat(checker.check(input()))
                .isEqualTo(new SpellOutcome.QuotaExceeded(QuotaKind.PER_DAY));
    }

    @Test
    void 서버_오류와_시간_초과() {
        server.expect(requestTo(URL)).andRespond(withServerError());
        assertThat(checker.check(input()))
                .isEqualTo(new SpellOutcome.Failed(FailureKind.SERVER_ERROR));
        server.reset();
        server.expect(requestTo(URL)).andRespond(withException(new SocketTimeoutException()));
        assertThat(checker.check(input())).isEqualTo(new SpellOutcome.Failed(FailureKind.TIMEOUT));
    }
}
