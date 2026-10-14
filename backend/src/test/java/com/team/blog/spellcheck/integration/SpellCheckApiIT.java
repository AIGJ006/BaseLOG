package com.team.blog.spellcheck.integration;

import static com.team.blog.tag.support.TagApi.body;
import static com.team.blog.tag.support.TagApi.read;
import static com.team.blog.tag.support.TagApi.status;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.team.blog.spellcheck.application.SpellIssue;
import com.team.blog.spellcheck.application.SpellOutcome;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import com.team.blog.support.ai.FakeSpellCheckConfiguration.FakeSpell;
import com.team.blog.support.fixture.PostFixtures;
import com.team.blog.tag.application.suggest.FailureKind;
import com.team.blog.tag.application.suggest.QuotaKind;
import com.team.blog.tag.support.AiSuggestApi;
import jakarta.servlet.http.Cookie;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.json.JsonMapper;

/** 맞춤법 검사 API (022 US1·US2, FR-003~FR-010). AI는 가짜 공급자. */
class SpellCheckApiIT extends IntegrationTestBase {

    private static final JsonMapper JSON = JsonMapper.builder().build();
    private static final String TEXT = "오늘은 공부를 할수있다고 생각했는데 잘 안되요.";

    @Autowired private FakeSpell fakeSpell;

    private AiSuggestApi ai;

    @BeforeEach
    void setUp() {
        fakeSpell.reset();
        ai = new AiSuggestApi(mockMvc, jdbc);
    }

    private record Author(long id, long postId, Cookie session) {}

    private Author author(PostFixtures.State state, boolean consent) {
        long id = members().member().create();
        if (consent) {
            ai.consent(id);
        }
        return new Author(
                id, new PostFixtures(jdbc).create(id, state), TestLogin.loginAs(mockMvc, id));
    }

    private Author author() {
        return author(PostFixtures.State.PUBLISHED_PUBLIC, true);
    }

    private MvcResult check(Cookie session, Object postId, String contentMd) throws Exception {
        return mockMvc.perform(
                        TestLogin.withCsrf(
                                post("/api/posts/{id}/spell-check", postId)
                                        .contentType(MediaType.APPLICATION_JSON)
                                        .content(
                                                JSON.writeValueAsString(
                                                        Map.of("contentMd", contentMd))),
                                session))
                .andReturn();
    }

    private String usageKey(long memberId) {
        return "ai:spell:usage:"
                + memberId
                + ":"
                + LocalDate.now(ZoneId.of("Asia/Seoul")).format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    @Test
    void 공개_글은_Gemini로_검사하고_글에_있는_고칠_곳만_돌려준다() throws Exception {
        Author a = author();
        fakeSpell
                .gemini()
                .respondIssues(
                        new SpellIssue("할수있다고", "할 수 있다고", "띄어쓰기"),
                        new SpellIssue("지어낸말", "지어낸 말", ""),
                        new SpellIssue("안되요", "안 돼요", "'돼요'가 맞아요"));

        MvcResult r = check(a.session(), a.postId(), TEXT + "\n```\n코드 안되요\n```");

        assertThat(status(r)).as(body(r)).isEqualTo(200);
        assertThat(body(r))
                .isEqualTo(
                        "{\"issues\":[{\"original\":\"할수있다고\",\"suggestion\":\"할 수 있다고\",\"reason\":\"띄어쓰기\"},"
                                + "{\"original\":\"안되요\",\"suggestion\":\"안 돼요\",\"reason\":\"'돼요'가 맞아요\"}],"
                                + "\"provider\":\"GEMINI\",\"truncated\":false,\"remainingToday\":29}");
        assertThat(r.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(fakeSpell.gemini().lastInput().text()).isEqualTo(TEXT);
        assertThat(fakeSpell.ollama().calls()).isZero();
        assertThat(redis.opsForValue().get(usageKey(a.id()))).isEqualTo("1");
    }

    @Test
    void 비공개_글은_자체_AI만() throws Exception {
        Author a = author(PostFixtures.State.PUBLISHED_PRIVATE, true);
        MvcResult r = check(a.session(), a.postId(), TEXT);
        assertThat(status(r)).as(body(r)).isEqualTo(200);
        assertThat((String) read(r, "$.provider")).isEqualTo("OLLAMA");
        assertThat(fakeSpell.gemini().calls()).isZero();
    }

    @Test
    void 비공개_글인데_자체_AI가_꺼져_있으면_503_NOT_PUBLIC이고_횟수는_그대로() throws Exception {
        Author a = author(PostFixtures.State.PUBLISHED_PRIVATE, true);
        fakeSpell.ollama().configured(false);
        MvcResult r = check(a.session(), a.postId(), TEXT);
        assertThat(status(r)).as(body(r)).isEqualTo(503);
        assertThat((String) read(r, "$.code")).isEqualTo("AI_UNAVAILABLE");
        assertThat((String) read(r, "$.details.reason")).isEqualTo("NOT_PUBLIC");
        assertThat((List<?>) read(r, "$.errors")).isEmpty();
        assertThat(fakeSpell.totalCalls()).isZero();
        assertThat(redis.opsForValue().get(usageKey(a.id()))).isNull();
    }

    @Test
    void Gemini_429면_자체_AI로_다시() throws Exception {
        Author a = author();
        fakeSpell.gemini().respond(new SpellOutcome.QuotaExceeded(QuotaKind.PER_MINUTE));
        MvcResult r = check(a.session(), a.postId(), TEXT);
        assertThat(status(r)).as(body(r)).isEqualTo(200);
        assertThat((String) read(r, "$.provider")).isEqualTo("OLLAMA");
        // 쉬는 중이라 다음 검사는 바로 자체 AI
        check(a.session(), a.postId(), TEXT);
        assertThat(fakeSpell.gemini().calls()).isEqualTo(1);
        assertThat(fakeSpell.ollama().calls()).isEqualTo(2);
    }

    @Test
    void 공급자_실패면_503_FAILED이고_횟수를_되돌린다() throws Exception {
        Author a = author();
        fakeSpell.gemini().respond(new SpellOutcome.Failed(FailureKind.TIMEOUT));
        MvcResult r = check(a.session(), a.postId(), TEXT);
        assertThat(status(r)).as(body(r)).isEqualTo(503);
        assertThat((String) read(r, "$.details.reason")).isEqualTo("FAILED");
        assertThat((String) read(r, "$.message")).doesNotEndWith(".");
        assertThat(redis.opsForValue().get(usageKey(a.id()))).isEqualTo("0");
    }

    @Test
    void 동의가_없으면_409() throws Exception {
        Author a = author(PostFixtures.State.PUBLISHED_PUBLIC, false);
        MvcResult r = check(a.session(), a.postId(), TEXT);
        assertThat(status(r)).as(body(r)).isEqualTo(409);
        assertThat((String) read(r, "$.code")).isEqualTo("AI_CONSENT_REQUIRED");
        assertThat((String) read(r, "$.details.version")).isEqualTo(AiSuggestApi.VERSION);
        assertThat(fakeSpell.totalCalls()).isZero();
    }

    @Test
    void 검사할_글자가_없으면_422() throws Exception {
        Author a = author();
        MvcResult r = check(a.session(), a.postId(), "```\n코드만\n```");
        assertThat(status(r)).as(body(r)).isEqualTo(422);
        assertThat((String) read(r, "$.code")).isEqualTo("CONTENT_TOO_SHORT");
        assertThat(fakeSpell.totalCalls()).isZero();
    }

    @Test
    void 남의_글과_없는_글은_404() throws Exception {
        Author a = author();
        Author other = author();
        assertThat(status(check(a.session(), other.postId(), TEXT))).isEqualTo(404);
        assertThat(status(check(a.session(), "abc", TEXT))).isEqualTo(404);
        assertThat(fakeSpell.totalCalls()).isZero();
    }

    @Test
    void 로그인하지_않으면_401() throws Exception {
        Author a = author();
        assertThat(status(check(null, a.postId(), TEXT))).isEqualTo(401);
    }

    @Test
    void 하루_한도를_넘으면_429_AI_DAILY_LIMIT() throws Exception {
        Author a = author();
        redis.opsForValue().set(usageKey(a.id()), "30");
        MvcResult r = check(a.session(), a.postId(), TEXT);
        assertThat(status(r)).as(body(r)).isEqualTo(429);
        assertThat((String) read(r, "$.code")).isEqualTo("AI_DAILY_LIMIT");
        assertThat(r.getResponse().getHeader("Retry-After")).isNotBlank();
        assertThat(fakeSpell.totalCalls()).isZero();
    }

    @Test
    void 긴_글은_앞부분만_보내고_truncated() throws Exception {
        Author a = author();
        String longText = (TEXT + "\n").repeat(200);
        MvcResult r = check(a.session(), a.postId(), longText);
        assertThat(status(r)).as(body(r)).isEqualTo(200);
        assertThat((Boolean) read(r, "$.truncated")).isTrue();
        assertThat(fakeSpell.gemini().lastInput().text().length()).isLessThanOrEqualTo(5000);
    }
}
