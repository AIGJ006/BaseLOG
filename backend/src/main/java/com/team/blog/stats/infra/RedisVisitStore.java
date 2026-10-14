package com.team.blog.stats.infra;

import com.team.blog.shared.infra.redis.RedisGuard;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 그날 방문자 Redis 저장소 (024). 방문자 키를 그대로 남기지 않고 HyperLogLog에 더해 수만 센다.
 *
 * <table>
 *   <caption>키</caption>
 *   <tr><td>{@code stats:visit:{yyyyMMdd}}</td><td>그날 방문자(회원·비회원), TTL 3일</td></tr>
 *   <tr><td>{@code stats:visit:{yyyyMMdd}:member}</td><td>그중 로그인 회원, TTL 3일</td></tr>
 * </table>
 *
 * 장애면 기록은 건너뛰고, 세기는 빈 값을 돌려준다(DB에 옮겨 둔 수를 쓴다).
 */
@Component
public class RedisVisitStore {

    /** 그날 방문자 수와 그중 회원 수. */
    public record DayCount(long visitors, long memberVisitors) {}

    private static final String PREFIX = "stats:visit:";
    private static final String MEMBER_SUFFIX = ":member";
    private static final Duration TTL = Duration.ofDays(3);
    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    private final StringRedisTemplate redis;
    private final RedisGuard redisGuard;

    public RedisVisitStore(StringRedisTemplate redis, RedisGuard redisGuard) {
        this.redis = redis;
        this.redisGuard = redisGuard;
    }

    static String key(LocalDate date) {
        return PREFIX + date.format(DAY);
    }

    /** 그날 방문자에 더한다({@code PFADD} + TTL). 장애면 건너뛴다. */
    public void record(LocalDate date, String visitorKey, boolean member) {
        String all = key(date);
        String members = all + MEMBER_SUFFIX;
        redisGuard.runWrite(
                () -> {
                    redis.opsForHyperLogLog().add(all, visitorKey);
                    redis.expire(all, TTL);
                    if (member) {
                        redis.opsForHyperLogLog().add(members, visitorKey);
                        redis.expire(members, TTL);
                    }
                },
                () -> {});
    }

    /** 그날 방문자 수({@code PFCOUNT}). 장애면 빈 값. */
    public Optional<DayCount> count(LocalDate date) {
        String all = key(date);
        return redisGuard.call(
                () ->
                        Optional.of(
                                new DayCount(
                                        redis.opsForHyperLogLog().size(all),
                                        redis.opsForHyperLogLog().size(all + MEMBER_SUFFIX))),
                Optional::empty);
    }
}
