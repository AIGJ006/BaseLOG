package com.team.blog.spellcheck.application;

import com.team.blog.tag.application.suggest.AiRedis;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;

/**
 * 회원 하루 맞춤법 검사 수 (022 spec 데이터 §2). 키 {@code ai:spell:usage:{memberId}:{yyyyMMdd 서비스 시간대}}, TTL 2일.
 * 013 {@code DailyUsage}와 같은 방식 — 부르기 전에 자리를 잡고(INCR, 넘으면 DECR 후 429), AI가 답을 주지 않은 요청만 되돌린다.
 */
@Component
public class SpellUsage {

    static final String KEY_PREFIX = "ai:spell:usage:";
    static final Duration KEY_TTL = Duration.ofDays(2);

    @SuppressWarnings("rawtypes")
    private static final RedisScript<List> RESERVE =
            new DefaultRedisScript<>(
                    """
                    local count = redis.call('INCR', KEYS[1])
                    if count == 1 then
                      redis.call('EXPIRE', KEYS[1], ARGV[2])
                    end
                    if count > tonumber(ARGV[1]) then
                      redis.call('DECR', KEYS[1])
                      return {0, count - 1}
                    end
                    return {1, count}
                    """,
                    List.class);

    private final StringRedisTemplate redis;
    private final AiRedis aiRedis;
    private final SpellCheckProperties properties;
    private final ZoneId zone;

    public SpellUsage(
            StringRedisTemplate redis,
            AiRedis aiRedis,
            SpellCheckProperties properties,
            ZoneId serviceZoneId) {
        this.redis = redis;
        this.aiRedis = aiRedis;
        this.properties = properties;
        this.zone = serviceZoneId;
    }

    /**
     * 자리 하나를 잡는다.
     *
     * @return 잡은 뒤 오늘 쓴 수
     * @throws SpellCheckErrors.DailyLimit 오늘 한도를 다 씀
     */
    @SuppressWarnings("unchecked")
    public int reserve(long memberId, Instant now) {
        String key = key(memberId, now);
        List<Long> result =
                aiRedis.call(
                        () ->
                                redis.execute(
                                        RESERVE,
                                        List.of(key),
                                        String.valueOf(limit()),
                                        String.valueOf(KEY_TTL.toSeconds())));
        if (result.get(0) == 0L) {
            throw new SpellCheckErrors.DailyLimit(now, resetAt(now));
        }
        return result.get(1).intValue();
    }

    /** 잡은 자리를 되돌린다. 실패해도 응답을 바꾸지 않는다. */
    public void release(long memberId, Instant now) {
        String key = key(memberId, now);
        aiRedis.quietly(() -> redis.opsForValue().decrement(key));
    }

    /** 오늘 남은 수. */
    public int remaining(int used) {
        return Math.max(0, limit() - used);
    }

    /** 다음 서비스 시간대 0시. */
    public Instant resetAt(Instant now) {
        return LocalDate.ofInstant(now, zone).plusDays(1).atStartOfDay(zone).toInstant();
    }

    String key(long memberId, Instant now) {
        return KEY_PREFIX
                + memberId
                + ":"
                + LocalDate.ofInstant(now, zone).format(DateTimeFormatter.BASIC_ISO_DATE);
    }

    private int limit() {
        return properties.dailyLimitPerMember();
    }
}
