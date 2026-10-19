package com.team.blog.stats.infra;

import com.team.blog.shared.infra.redis.RedisGuard;
import java.time.Duration;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

/**
 * 둥지별 그날 방문자 Redis 저장소 (031). 방문자 키를 그대로 남기지 않고 둥지마다 HyperLogLog에 더해 수만 센다.
 *
 * <table>
 *   <caption>키</caption>
 *   <tr><td>{@code stats:nest-visit:{yyyyMMdd}:{주인 번호}}</td><td>그날 그 둥지 방문자, TTL 3일</td></tr>
 *   <tr><td>{@code stats:nest-visit:{yyyyMMdd}:owners}</td><td>그날 방문자가 있는 둥지 주인 번호(옮길 때 쓴다), TTL 3일</td></tr>
 * </table>
 *
 * 장애면 기록은 건너뛰고, 세기는 빈 값을 돌려준다(DB에 옮겨 둔 수를 쓴다).
 */
@Component
public class RedisBlogVisitStore {

    private static final String PREFIX = "stats:nest-visit:";
    private static final String OWNERS = "owners";
    private static final Duration TTL = Duration.ofDays(3);
    private static final DateTimeFormatter DAY = DateTimeFormatter.BASIC_ISO_DATE;

    private final StringRedisTemplate redis;
    private final RedisGuard redisGuard;

    public RedisBlogVisitStore(StringRedisTemplate redis, RedisGuard redisGuard) {
        this.redis = redis;
        this.redisGuard = redisGuard;
    }

    static String key(LocalDate date, long ownerId) {
        return PREFIX + date.format(DAY) + ":" + ownerId;
    }

    static String ownersKey(LocalDate date) {
        return PREFIX + date.format(DAY) + ":" + OWNERS;
    }

    /** 그날 그 둥지 방문자에 더한다({@code PFADD} + TTL). 장애면 건너뛴다. */
    public void recordVisit(LocalDate date, long ownerId, String visitorKey) {
        String visits = key(date, ownerId);
        String owners = ownersKey(date);
        redisGuard.runWrite(
                () -> {
                    redis.opsForHyperLogLog().add(visits, visitorKey);
                    redis.expire(visits, TTL);
                    redis.opsForSet().add(owners, Long.toString(ownerId));
                    redis.expire(owners, TTL);
                },
                () -> {});
    }

    /** 그날 그 둥지 방문자 수({@code PFCOUNT}). 장애면 빈 값. */
    public Optional<Long> count(LocalDate date, long ownerId) {
        return redisGuard.call(
                () -> Optional.of(redis.opsForHyperLogLog().size(key(date, ownerId))),
                Optional::empty);
    }

    /** 그날 방문자가 있는 둥지마다 방문자 수(주인 번호 순). 장애면 빈 값. */
    public Optional<Map<Long, Long>> countAll(LocalDate date) {
        return redisGuard.call(
                () -> {
                    Set<String> owners = redis.opsForSet().members(ownersKey(date));
                    Map<Long, Long> out = new TreeMap<>();
                    if (owners != null) {
                        for (String owner : owners) {
                            long id = Long.parseLong(owner);
                            out.put(id, redis.opsForHyperLogLog().size(key(date, id)));
                        }
                    }
                    return Optional.of(out);
                },
                Optional::empty);
    }
}
