package com.team.blog.account.infra.redis;

import com.team.blog.account.infra.AccountProperties;
import com.team.blog.shared.error.TemporarilyUnavailableException;
import com.team.blog.shared.infra.redis.RedisGuard;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.List;
import java.util.Objects;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 가입 전 이메일 인증 코드 (2026-10-14). DB에는 남기지 않고 Redis에만 둔다. 이메일은 소문자로 정규화한 값의 SHA-256으로만 키에 쓴다.
 *
 * <ul>
 *   <li>{@code auth:signup-code:{emailHash}} = 6자리 숫자 (TTL {@code blog.auth.signup-code.code-ttl}).
 *       새로 보내면 이전 코드는 덮어써져 무효다.
 *   <li>{@code auth:signup-code-tries:{emailHash}} = 틀린 횟수. {@code max-attempts}번을 넘기면 코드를 지운다(다시
 *       받아야 함) — 6자리를 하나씩 맞혀 보는 것을 막는다.
 *   <li>{@code auth:signup-verified:{emailHash}} = 확인 표시 (TTL {@code verified-ttl}). 가입이 끝나면 지운다.
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

    private static final String CODE_PREFIX = "auth:signup-code:";
    private static final String TRIES_PREFIX = "auth:signup-code-tries:";
    private static final String VERIFIED_PREFIX = "auth:signup-verified:";

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

    /** 코드를 확인한다. 맞으면 코드를 지우고 확인 표시를 남긴다. */
    public Check check(String normalizedEmail, String code) {
        String hash = emailHash(normalizedEmail);
        return redisGuard.callWrite(
                () -> {
                    String saved = redis.opsForValue().get(CODE_PREFIX + hash);
                    if (saved == null) {
                        return Check.EXPIRED;
                    }
                    if (Objects.equals(saved, code)) {
                        redis.delete(List.of(CODE_PREFIX + hash, TRIES_PREFIX + hash));
                        redis.opsForValue()
                                .set(VERIFIED_PREFIX + hash, "1", settings.verifiedTtl());
                        return Check.MATCH;
                    }
                    Long tries = redis.opsForValue().increment(TRIES_PREFIX + hash);
                    redis.expire(TRIES_PREFIX + hash, settings.codeTtl());
                    if (tries != null && tries >= settings.maxAttempts()) {
                        redis.delete(List.of(CODE_PREFIX + hash, TRIES_PREFIX + hash));
                        return Check.TOO_MANY_ATTEMPTS;
                    }
                    return Check.MISMATCH;
                },
                SignupCodeStore::unavailable);
    }

    /** 코드 확인을 마친 이메일인가. */
    public boolean isVerified(String normalizedEmail) {
        String key = VERIFIED_PREFIX + emailHash(normalizedEmail);
        return redisGuard.call(() -> redis.hasKey(key), SignupCodeStore::unavailable);
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
