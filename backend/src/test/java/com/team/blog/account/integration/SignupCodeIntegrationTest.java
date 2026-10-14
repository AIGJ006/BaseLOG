package com.team.blog.account.integration;

import static com.team.blog.account.integration.SignupRequests.awaitMailCount;
import static com.team.blog.account.integration.SignupRequests.body;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.team.blog.account.infra.redis.SignupCodeStore;
import com.team.blog.support.CapturingMailSender;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.RedisOutage;
import com.team.blog.support.TestLogin;
import jakarta.mail.MessagingException;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

/** 가입 전 이메일 인증 코드 (2026-10-14): 코드 받기 → 확인 → 가입. */
class SignupCodeIntegrationTest extends IntegrationTestBase {

    private static final String EMAIL = "kim755030@naver.com";
    private static final Pattern CODE = Pattern.compile("인증 코드: (\\d{6})");

    @Test
    void sendVerifyThenSignupCreatesVerifiedAccount() throws Exception {
        send(" Kim755030@Naver.com ").andExpect(status().isAccepted());
        awaitMailCount(mailSender, EMAIL, 1);
        String code = codeIn(mailSender, EMAIL);
        assertThat(mailSender.lastTextFor(EMAIL).orElseThrow()).contains("10분 동안");
        assertThat(subjectOf(EMAIL)).startsWith("[BaseLOG]").contains(code);
        Long ttl = redis.getExpire("auth:signup-code:" + hashOf(EMAIL));
        assertThat(ttl)
                .isBetween(Duration.ofMinutes(9).toSeconds(), Duration.ofMinutes(10).toSeconds());

        verify(EMAIL, code)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verified").value(true));

        mockMvc.perform(body(EMAIL, "kim755030", "김민서").unverified().request())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.emailVerified").value(true));
        assertThat(
                        jdbc.queryForObject(
                                "SELECT email_verified_at IS NOT NULL FROM auth_identity",
                                Boolean.class))
                .isTrue();
        assertThat(redis.hasKey(SignupCodeStore.verifiedKey(EMAIL))).isFalse();
    }

    @Test
    void codeIsUsedOnlyOnce() throws Exception {
        send(EMAIL).andExpect(status().isAccepted());
        awaitMailCount(mailSender, EMAIL, 1);
        String code = codeIn(mailSender, EMAIL);
        verify(EMAIL, code).andExpect(status().isOk());
        verify(EMAIL, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("EMAIL_CODE_EXPIRED"));
    }

    @Test
    void wrongCodeIsFieldErrorAndFifthMistakeDeletesCode() throws Exception {
        send(EMAIL).andExpect(status().isAccepted());
        awaitMailCount(mailSender, EMAIL, 1);
        String code = codeIn(mailSender, EMAIL);
        String wrong = code.equals("000000") ? "111111" : "000000";

        for (int i = 0; i < 4; i++) {
            verify(EMAIL, wrong)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.errors[0].field").value("code"))
                    .andExpect(jsonPath("$.errors[0].code").value("EMAIL_CODE_MISMATCH"))
                    .andExpect(jsonPath("$.errors[0].message").value("인증 코드가 맞지 않아요"));
        }
        verify(EMAIL, wrong)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("EMAIL_CODE_TOO_MANY_ATTEMPTS"));
        verify(EMAIL, code)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].code").value("EMAIL_CODE_EXPIRED"));
        assertThat(redis.hasKey(SignupCodeStore.verifiedKey(EMAIL))).isFalse();
    }

    @Test
    void malformedCodeOrEmailIsFieldError() throws Exception {
        verify(EMAIL, "12ab")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("code"))
                .andExpect(jsonPath("$.errors[0].code").value("EMAIL_CODE_INVALID_FORMAT"));
        send("not-an-email")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("email"))
                .andExpect(jsonPath("$.errors[0].code").value("EMAIL_INVALID_FORMAT"));
    }

    @Test
    void newCodeReplacesPreviousOne() throws Exception {
        send(EMAIL).andExpect(status().isAccepted());
        awaitMailCount(mailSender, EMAIL, 1);
        String first = codeIn(mailSender, EMAIL);
        redis.delete(redis.keys("rl:signup-code:email:*")); // 1분 제한은 이 테스트에서 건너뛴다
        send(EMAIL).andExpect(status().isAccepted());
        awaitMailCount(mailSender, EMAIL, 2);
        String second = codeIn(mailSender, EMAIL);
        if (!first.equals(second)) {
            verify(EMAIL, first)
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].code").value("EMAIL_CODE_MISMATCH"));
        }
        verify(EMAIL, second).andExpect(status().isOk());
    }

    @Test
    void sendIsLimitedToOncePerMinutePerEmail() throws Exception {
        send(EMAIL).andExpect(status().isAccepted());
        send(EMAIL)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"))
                .andExpect(header().exists("Retry-After"));
        awaitMailCount(mailSender, EMAIL, 1);
        SignupRequests.assertMailCountStays(mailSender, EMAIL, 1);
    }

    @Test
    void registeredEmailGetsNoCodeForEmailSignupButSocialSignupMay() throws Exception {
        members().member().email(EMAIL).create();
        send(EMAIL)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("email"))
                .andExpect(jsonPath("$.errors[0].code").value("EMAIL_ALREADY_REGISTERED"));
        SignupRequests.assertMailCountStays(mailSender, EMAIL, 0);

        post("{\"email\":\"" + EMAIL + "\",\"socialSignup\":true}", "/api/auth/signup-code")
                .andExpect(status().isAccepted());
        awaitMailCount(mailSender, EMAIL, 1);
    }

    @Test
    void redisOutageRejectsSendWith503() throws Exception {
        try (RedisOutage ignored = RedisOutage.start()) {
            send(EMAIL)
                    .andExpect(status().isServiceUnavailable())
                    .andExpect(jsonPath("$.code").value("TEMPORARILY_UNAVAILABLE"));
        }
        SignupRequests.assertMailCountStays(mailSender, EMAIL, 0);
    }

    /** 가장 최근 인증 코드 메일의 6자리 숫자. */
    static String codeIn(CapturingMailSender mail, String email) {
        Matcher m = CODE.matcher(mail.lastTextFor(email).orElseThrow());
        assertThat(m.find()).as("메일에 인증 코드가 있어야 한다").isTrue();
        return m.group(1);
    }

    private String subjectOf(String email) throws MessagingException {
        var messages = mailSender.messagesTo(email);
        return messages.get(messages.size() - 1).getSubject();
    }

    private static String hashOf(String email) {
        String key = SignupCodeStore.verifiedKey(email);
        return key.substring(key.lastIndexOf(':') + 1);
    }

    private ResultActions send(String email) throws Exception {
        return post("{\"email\":\"" + email + "\"}", "/api/auth/signup-code");
    }

    private ResultActions verify(String email, String code) throws Exception {
        return post(
                "{\"email\":\"" + email + "\",\"code\":\"" + code + "\"}",
                "/api/auth/signup-code/verify");
    }

    private ResultActions post(String json, String path) throws Exception {
        return mockMvc.perform(
                TestLogin.withCsrf(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post(
                                        path)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json),
                        null));
    }
}
