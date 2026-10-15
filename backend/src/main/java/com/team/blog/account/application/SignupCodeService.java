package com.team.blog.account.application;

import com.team.blog.account.application.mail.SignupCodeMailRequested;
import com.team.blog.account.domain.MemberStatus;
import com.team.blog.account.domain.Provider;
import com.team.blog.account.infra.AccountProperties;
import com.team.blog.account.infra.AuthIdentityRepository;
import com.team.blog.account.infra.MemberRepository;
import com.team.blog.account.infra.redis.SignupCodeStore;
import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.TemporarilyUnavailableException;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.infra.ratelimit.RateLimiter;
import com.team.blog.shared.infra.redis.RedisGuard;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

/**
 * 가입 전 이메일 인증 코드 (2026-10-14). 가입 화면에서 [인증 코드 받기] → 메일로 온 6자리 숫자 확인 → 그 이메일로만 가입할 수 있다. 가입하면 바로 인증된
 * 계정이라 인증 전 계정이 생기지 않는다.
 *
 * <ul>
 *   <li>{@link #send}: 이메일 형식 → (이메일 가입이면) 이미 가입된 이메일인지 → 요청 제한(같은 IP 1시간 20번, 같은 이메일 1분 1번·하루 10번
 *       → 429) → 코드 저장(Redis 장애면 503) → 메일은 {@code mailExecutor}가 보낸다.
 *   <li>{@link #verify}: 맞으면 확인 토큰을 남기고 돌려준다(1시간, 가입 요청에 실어 보냄). 틀리면 칸 오류, 5번 틀리면 코드를 지운다.
 * </ul>
 */
@Service
public class SignupCodeService {

    static final String EMAIL_KEY = "rl:signup-code:email:";
    static final String EMAIL_DAY_KEY = "rl:signup-code:email-day:";
    static final String IP_KEY = "rl:signup-code:ip:";
    private static final Duration DAY_WINDOW = Duration.ofDays(2);
    private static final String EMAIL_FIELD = "email";
    private static final Duration HOUR = Duration.ofHours(1);
    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;
    private static final Pattern CODE_FORMAT = Pattern.compile("^\\d{6}$");

    private final AuthIdentityRepository authIdentities;
    private final MemberRepository members;
    private final SignupCodeStore codeStore;
    private final RateLimiter rateLimiter;
    private final RedisGuard redisGuard;
    private final ApplicationEventPublisher events;
    private final AccountProperties.SignupCode settings;
    private final Clock clock;
    private final ZoneId zone;

    public SignupCodeService(
            AuthIdentityRepository authIdentities,
            MemberRepository members,
            SignupCodeStore codeStore,
            RateLimiter rateLimiter,
            RedisGuard redisGuard,
            ApplicationEventPublisher events,
            AccountProperties properties,
            Clock clock,
            ZoneId serviceZoneId) {
        this.authIdentities = authIdentities;
        this.members = members;
        this.codeStore = codeStore;
        this.rateLimiter = rateLimiter;
        this.redisGuard = redisGuard;
        this.events = events;
        this.settings = properties.auth().signupCode();
        this.clock = clock;
        this.zone = serviceZoneId;
    }

    /**
     * 인증 코드 메일 보내기.
     *
     * @param forEmailSignup 이메일 가입 화면이면 true — 이미 이메일 가입 계정이 있으면 코드를 보내지 않고 알려 준다. 소셜 가입은 같은 이메일의
     *     이메일 가입 계정이 있어도 가입할 수 있다.
     */
    public void send(String rawEmail, boolean forEmailSignup, String clientIp) {
        String email = EmailAddress.normalize(rawEmail);
        if (!EmailAddress.isValid(email)) {
            throw fieldError(EMAIL_FIELD, AccountReasonCode.EMAIL_INVALID_FORMAT);
        }
        if (forEmailSignup) {
            authIdentities
                    .findByProviderAndProviderUserId(Provider.LOCAL, email)
                    .ifPresent(
                            existing -> {
                                throw fieldError(
                                        EMAIL_FIELD,
                                        isWithdrawalPending(existing.getMemberId())
                                                ? AccountReasonCode.EMAIL_WITHDRAWAL_PENDING
                                                : AccountReasonCode.EMAIL_ALREADY_REGISTERED);
                            });
        }
        if (!redisGuard.isAvailable()) {
            throw new TemporarilyUnavailableException();
        }
        String hash = PasswordResetService.sha256(email);
        String today = LocalDate.now(clock.withZone(zone)).format(DAY);
        rateLimiter.acquireOrThrow(IP_KEY + clientIp, settings.ipLimitPerHour(), HOUR);
        rateLimiter.acquireOrThrow(EMAIL_KEY + hash, 1, settings.emailInterval());
        rateLimiter.acquireOrThrow(
                EMAIL_DAY_KEY + hash + ":" + today, settings.emailDailyLimit(), DAY_WINDOW);
        String code = codeStore.issue(email);
        events.publishEvent(new SignupCodeMailRequested(email, code));
    }

    private boolean isWithdrawalPending(long memberId) {
        return members.findById(memberId)
                .filter(m -> m.getStatus() == MemberStatus.WITHDRAWN)
                .filter(m -> !m.isDeleted())
                .isPresent();
    }

    /** 인증 코드 확인. 맞으면 가입 요청에 실을 확인 토큰을 돌려주고, 아니면 400 칸 오류. */
    public String verify(String rawEmail, String rawCode) {
        String email = EmailAddress.normalize(rawEmail);
        if (!EmailAddress.isValid(email)) {
            throw fieldError(EMAIL_FIELD, AccountReasonCode.EMAIL_INVALID_FORMAT);
        }
        String code = rawCode == null ? "" : rawCode.strip();
        if (!CODE_FORMAT.matcher(code).matches()) {
            throw fieldError("code", AccountReasonCode.EMAIL_CODE_INVALID_FORMAT);
        }
        SignupCodeStore.CheckResult result = codeStore.check(email, code);
        return switch (result.check()) {
            case MATCH -> result.token();
            case MISMATCH -> throw fieldError("code", AccountReasonCode.EMAIL_CODE_MISMATCH);
            case EXPIRED -> throw fieldError("code", AccountReasonCode.EMAIL_CODE_EXPIRED);
            case TOO_MANY_ATTEMPTS ->
                    throw fieldError("code", AccountReasonCode.EMAIL_CODE_TOO_MANY_ATTEMPTS);
        };
    }

    /** 가입 직전 검사: 이 토큰을 받은 쪽이 이 이메일로 코드 확인을 마쳤는가. */
    public boolean isVerified(String normalizedEmail, String signupToken) {
        return codeStore.isVerified(normalizedEmail, signupToken);
    }

    /** 가입을 마친 뒤 확인 표시를 지운다(트랜잭션 밖에서). */
    public void clearVerified(String normalizedEmail) {
        codeStore.clearVerified(normalizedEmail);
    }

    static FieldError notVerified(String field) {
        return new FieldError(
                field,
                AccountReasonCode.EMAIL_NOT_VERIFIED.code(),
                AccountReasonCode.EMAIL_NOT_VERIFIED.defaultMessage());
    }

    private static ValidationException fieldError(String field, AccountReasonCode code) {
        return new ValidationException(
                List.of(new FieldError(field, code.code(), code.defaultMessage())));
    }
}
