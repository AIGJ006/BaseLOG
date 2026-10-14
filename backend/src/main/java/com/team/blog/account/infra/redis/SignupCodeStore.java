package com.team.blog.account.infra.redis;

import com.team.blog.account.infra.AccountProperties;
import com.team.blog.shared.error.TemporarilyUnavailableException;
import com.team.blog.shared.infra.redis.RedisGuard;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * 가입 전 이메일 인증 코드 (2026-10-14). DB에는 남기지 않고 Redis에만 둔다. 이메일은 소문자로 정규화한 값의 SHA-256으로만 키에 쓴다.
 *
 * <ul>
 *   <li>{@code auth:signup-code:{emailHash}} = 6자리 숫자 (TTL {@code blog.auth.signup-code.code-ttl}).
 *       새로 보내면 이전 코드는 덮어써져 무효다.
 *   <li>{@code auth:signup-code-tries:{emailHash}} = 틀린 횟수. {@code max-attempts}번을 넘기면 코드를 지운다(다시
 *       받아야 함) — 6자리를 하나씩 맞혀 보는 것을 막는다.
 *   <li>{@code auth:signup-verified:{emailHash}} = 확인 토큰 (TTL {@code verified-ttl}). 코드를 맞힌 쪽만 받는
 *       무작위 값이라, 주소만 아는 다른 사람은 그 사이에 같은 주소로 가입할 수 없다. 가입이 끝나면 지운다.
 *   <li>Redis 장애: {@link TemporarilyUnavailableException}(503) — 확인을 건너뛰고 통과시키지 않는다.
 * </ul>
 *
 * 코드 값은 로그에 남기지 않는다(FR-015).
 */
@Component
public class SignupCodeStore {

    /** 코드 확인 결과. */
    public enum Check {
        MATCH,
        MISMATCH,
        /** 코드가 없거나 만료됐다. */
        EXPIRED,
        /** 틀린 횟수를 넘겨 코드를 지웠다. */
        TOO_MANY_ATTEMPTS
    }

    /** 코드 확인 결과와, 맞았을 때 가입 요청에 실어 보낼 토큰. */
    public record CheckResult(Check check, String token) {

        static CheckResult of(Check check) {
            return new CheckResult(check, null);
        }

        @Override
        public String toString() {
            return "CheckResult[check=" + check + "]";
        }
    }

    private static final String CODE_PREFIX = "auth:signup-code:";
    private static final String TRIES_PREFIX = "auth:signup-code-tries:";
    private static final String VERIFIED_PREFIX = "auth:signup-verified:";

    /**
     * 비교·틀린 횟수 증가·초과 시 삭제를 한 번에 한다. 나눠 하면 동시에 보낸 요청들이 지워지기 전의 코드를 읽어 5번 제한을 넘겨 맞혀 볼 수 있다. 0 =
     * 없음·만료, 1 = 맞음(토큰 저장), 2 = 틀림, 3 = 틀린 횟수 초과(코드 삭제).
     */
    private static final RedisScript<Long> CHECK_SCRIPT =
            new DefaultRedisScript<>(
                    """
                    local saved = redis.call('GET', KEYS[1])
                    if not saved then
                      return 0
                    end
                    if saved == ARGV[1] then
                      redis.call('DEL', KEYS[1], KEYS[2])
                      redis.call('SET', KEYS[3], ARGV[2], 'PX', ARGV[3])
                      return 1
                    end
                    local tries = redis.call('INCR', KEYS[2])
                    redis.call('PEXPIRE', KEYS[2], ARGV[4])
                    if tries >= tonumber(ARGV[5]) then
                      redis.call('DEL', KEYS[1], KEYS[2])
                      return 3
                    end
                    return 2
                    """,
                    Long.class);

    private final StringRedisTemplate redis;
    private final RedisGuard redisGuard;
    private final AccountProperties.SignupCode settings;
    private final SecureRandom random = new SecureRandom();

    public SignupCodeStore(
            StringRedisTemplate redis, RedisGuard redisGuard, AccountProperties properties) {
        this.redis = redis;
        this.redisGuard = redisGuard;
        this.settings = properties.auth().signupCode();
    }

    /** 새 6자리 코드를 만들어 저장한다(이전 코드·틀린 횟수는 지운다). */
    public String issue(String normalizedEmail) {
        String code = String.format("%06d", random.nextInt(1_000_000));
        String hash = emailHash(normalizedEmail);
        redisGuard.callWrite(
                () -> {
                    redis.opsForValue().set(CODE_PREFIX + hash, code, settings.codeTtl());
                    redis.delete(TRIES_PREFIX + hash);
                    return null;
                },
                SignupCodeStore::unavailable);
        return code;
    }

    /** 코드를 확인한다. 맞으면 코드를 지우고 확인 토큰을 남겨 돌려준다. */
    public CheckResult check(String normalizedEmail, String code) {
        String hash = emailHash(normalizedEmail);
        String token = newToken();
        Long outcome =
                redisGuard.callWrite(
                        () ->
                                redis.execute(
                                        CHECK_SCRIPT,
                                        List.of(
                                                CODE_PREFIX + hash,
                                                TRIES_PREFIX + hash,
                                                VERIFIED_PREFIX + hash),
                                        code,
                                        token,
                                        String.valueOf(settings.verifiedTtl().toMillis()),
                                        String.valueOf(settings.codeTtl().toMillis()),
                                        String.valueOf(settings.maxAttempts())),
                        SignupCodeStore::unavailable);
        return switch (outcome == null ? 0 : outcome.intValue()) {
            case 1 -> new CheckResult(Check.MATCH, token);
            case 2 -> CheckResult.of(Check.MISMATCH);
            case 3 -> CheckResult.of(Check.TOO_MANY_ATTEMPTS);
            default -> CheckResult.of(Check.EXPIRED);
        };
    }

    /** 이 토큰을 받은 쪽이 이 이메일의 코드 확인을 마쳤는가. */
    public boolean isVerified(String normalizedEmail, String token) {
        if (token == null || token.isBlank()) {
            return false;
        }
        String key = VERIFIED_PREFIX + emailHash(normalizedEmail);
        String saved =
                redisGuard.call(() -> redis.opsForValue().get(key), SignupCodeStore::unavailable);
        return saved != null
                && MessageDigest.isEqual(
                        saved.getBytes(StandardCharsets.UTF_8),
                        token.getBytes(StandardCharsets.UTF_8));
    }

    /** 가입을 마친 뒤 확인 표시를 지운다. 실패해도 표시는 TTL로 사라지므로 삼킨다. */
    public void clearVerified(String normalizedEmail) {
        String key = VERIFIED_PREFIX + emailHash(normalizedEmail);
        redisGuard.runWrite(() -> redis.delete(key), () -> {});
    }

    /** 확인 표시 키 (테스트가 확인을 마친 상태를 만들 때 쓴다). */
    public static String verifiedKey(String normalizedEmail) {
        return VERIFIED_PREFIX + emailHash(normalizedEmail);
    }

    private String newToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String emailHash(String normalizedEmail) {
        try {
            return HexFormat.of()
                    .formatHex(
                            MessageDigest.getInstance("SHA-256")
                                    .digest(normalizedEmail.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static <T> T unavailable() {
        throw new TemporarilyUnavailableException();
    }
}
