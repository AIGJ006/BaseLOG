package com.team.blog.support;

import com.team.blog.account.application.EmailAddress;
import com.team.blog.account.infra.redis.SignupCodeStore;
import java.time.Duration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.context.support.WebApplicationContextUtils;

/**
 * 가입 요청 전에 그 이메일의 가입 인증 코드 확인을 마친 상태로 만든다 (2026-10-14 코드 인증). 확인 토큰은 {@link #TOKEN}이라 가입 본문의 {@code
 * signupToken}에 같은 값을 실어야 한다.
 */
public final class SignupCodeVerified {

    /** 테스트가 쓰는 확인 토큰. */
    public static final String TOKEN = "test-signup-token";

    private SignupCodeVerified() {}

    /** 요청을 보내기 직전에 확인 토큰을 Redis에 남긴다. Redis 장애를 재현하는 중이면 아무 일도 하지 않는다. */
    public static RequestPostProcessor of(String rawEmail) {
        return request -> {
            StringRedisTemplate redis =
                    WebApplicationContextUtils.getRequiredWebApplicationContext(
                                    request.getServletContext())
                            .getBean(StringRedisTemplate.class);
            try {
                redis.opsForValue()
                        .set(
                                SignupCodeStore.verifiedKey(EmailAddress.normalize(rawEmail)),
                                TOKEN,
                                Duration.ofHours(1));
            } catch (RuntimeException e) {
                // Redis 장애 재현 중: 가입 쪽이 503을 내는지 본다.
            }
            return request;
        };
    }
}
