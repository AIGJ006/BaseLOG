package com.team.blog.account.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowableOfType;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.team.blog.account.application.mail.SignupCodeMailRequested;
import com.team.blog.account.domain.AuthIdentity;
import com.team.blog.account.domain.Provider;
import com.team.blog.account.infra.AccountProperties;
import com.team.blog.account.infra.AuthIdentityRepository;
import com.team.blog.account.infra.MemberRepository;
import com.team.blog.account.infra.redis.SignupCodeStore;
import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.infra.ratelimit.RateLimiter;
import com.team.blog.shared.infra.redis.RedisGuard;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

/** 가입 인증 코드 서비스의 분기 (Redis·DB 없이). 실제 Redis 흐름은 {@code SignupCodeIntegrationTest}. */
class SignupCodeServiceTest {

    private static final String EMAIL = "kim755030@naver.com";

    private final AuthIdentityRepository authIdentities = mock(AuthIdentityRepository.class);
    private final MemberRepository members = mock(MemberRepository.class);
    private final SignupCodeStore store = mock(SignupCodeStore.class);
    private final RateLimiter rateLimiter = mock(RateLimiter.class);
    private final RedisGuard redisGuard = mock(RedisGuard.class);
    private final ApplicationEventPublisher events = mock(ApplicationEventPublisher.class);
    private SignupCodeService service;

    @BeforeEach
    void setUp() {
        AccountProperties properties = mock(AccountProperties.class);
        AccountProperties.Auth auth = mock(AccountProperties.Auth.class);
        when(properties.auth()).thenReturn(auth);
        when(auth.signupCode())
                .thenReturn(
                        new AccountProperties.SignupCode(
                                Duration.ofMinutes(10),
                                5,
                                Duration.ofHours(1),
                                Duration.ofMinutes(1),
                                10,
                                20));
        when(redisGuard.isAvailable()).thenReturn(true);
        service =
                new SignupCodeService(
                        authIdentities,
                        members,
                        store,
                        rateLimiter,
                        redisGuard,
                        events,
                        properties,
                        Clock.fixed(Instant.parse("2026-10-14T05:00:00Z"), ZoneId.of("UTC")),
                        ZoneId.of("Asia/Seoul"));
    }

    @Test
    void sendNormalizesEmailStoresCodeAndPublishesMail() {
        when(store.issue(EMAIL)).thenReturn("123456");
        service.send(" Kim755030@Naver.com ", true, "1.2.3.4");
        verify(store).issue(EMAIL);
        verify(events).publishEvent(new SignupCodeMailRequested(EMAIL, "123456"));
    }

    @Test
    void sendRejectsRegisteredEmailForEmailSignupOnly() {
        AuthIdentity existing = AuthIdentity.local(7L, EMAIL, "hash", Instant.now());
        when(authIdentities.findByProviderAndProviderUserId(Provider.LOCAL, EMAIL))
                .thenReturn(Optional.of(existing));
        when(members.findById(7L)).thenReturn(Optional.empty());

        assertThat(fieldErrorOf(() -> service.send(EMAIL, true, "ip")).code())
                .isEqualTo("EMAIL_ALREADY_REGISTERED");
        verify(store, never()).issue(anyString());

        when(store.issue(EMAIL)).thenReturn("654321");
        service.send(EMAIL, false, "ip");
        verify(events).publishEvent(any(SignupCodeMailRequested.class));
    }

    @Test
    void verifyMapsStoreResultsToFieldErrors() {
        when(store.check(EMAIL, "111111")).thenReturn(SignupCodeStore.Check.MISMATCH);
        when(store.check(EMAIL, "222222")).thenReturn(SignupCodeStore.Check.EXPIRED);
        when(store.check(EMAIL, "333333")).thenReturn(SignupCodeStore.Check.TOO_MANY_ATTEMPTS);
        when(store.check(EMAIL, "444444")).thenReturn(SignupCodeStore.Check.MATCH);

        assertThat(fieldErrorOf(() -> service.verify(EMAIL, "111111")))
                .extracting(FieldError::field, FieldError::code)
                .containsExactly("code", "EMAIL_CODE_MISMATCH");
        assertThat(fieldErrorOf(() -> service.verify(EMAIL, "222222")).code())
                .isEqualTo("EMAIL_CODE_EXPIRED");
        assertThat(fieldErrorOf(() -> service.verify(EMAIL, "333333")).code())
                .isEqualTo("EMAIL_CODE_TOO_MANY_ATTEMPTS");
        service.verify(EMAIL, " 444444 ");
    }

    @Test
    void verifyChecksFormatBeforeTouchingStore() {
        assertThat(fieldErrorOf(() -> service.verify(EMAIL, "12ab56")).code())
                .isEqualTo("EMAIL_CODE_INVALID_FORMAT");
        assertThat(fieldErrorOf(() -> service.verify("nope", "123456")).code())
                .isEqualTo("EMAIL_INVALID_FORMAT");
        verify(store, never()).check(anyString(), anyString());
    }

    private static FieldError fieldErrorOf(Runnable action) {
        ValidationException e = catchThrowableOfType(ValidationException.class, action::run);
        assertThat(e).as("칸 오류여야 한다").isNotNull();
        return e.errors().getFirst();
    }
}
