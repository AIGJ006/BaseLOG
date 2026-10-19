package com.team.blog.stats.application;

import com.team.blog.account.application.BlogOwner;
import com.team.blog.account.application.MemberQueryService;
import com.team.blog.interaction.application.ViewExclusion;
import com.team.blog.interaction.application.ViewProperties;
import com.team.blog.interaction.application.VisitorKeyResolver;
import com.team.blog.post.application.exception.AutosaveUnavailableException;
import com.team.blog.shared.infra.ratelimit.RateLimiter;
import com.team.blog.shared.security.Viewer;
import com.team.blog.stats.application.VisitRecordService.VisitRequest;
import com.team.blog.stats.infra.RedisBlogVisitStore;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Service;

/**
 * 둥지 방문 기록 (031, {@code POST /api/members/{handle}/visits}). 화면이 둥지({@code /@주소})를 열면 둥지마다 하루 한 번
 * 보낸다.
 *
 * <ol>
 *   <li>둥지 주인 — 001 {@link MemberQueryService#findReadableBlogOwner}. 없거나 탈퇴 중이면 건너뜀
 *   <li>빼기 — 둥지 주인 본인, 관리자, 봇·링크 미리보기·미리 불러오기(024 사이트 방문과 같다)
 *   <li>방문자 키 — 009 {@link VisitorKeyResolver}(회원 번호, 비회원은 {@code vid} 쿠키 해시)
 *   <li>요청 제한 {@code ratelimit:nest-visit:{방문자 키}} 1분 {@value #RATE_LIMIT}번 → 429. Redis 장애면 통과
 *   <li>그날 그 둥지 방문자에 더하기({@link RedisBlogVisitStore}) — 장애면 건너뜀
 * </ol>
 *
 * 방문 기록은 어떤 경우에도 화면을 막지 않는다. 트랜잭션을 열지 않는다(Redis 쓰기).
 */
@Service
public class BlogVisitRecordService {

    /** 요청 제한 키 접두어. 뒤에는 방문자 키만 붙는다. */
    public static final String RATE_LIMIT_PREFIX = "ratelimit:nest-visit:";

    /** 여러 둥지를 돌아다니는 방문자를 막지 않도록 사이트 방문(30)보다 넉넉하게 둔다. */
    static final int RATE_LIMIT = 60;

    private final MemberQueryService members;
    private final VisitorKeyResolver visitorKeys;
    private final RateLimiter rateLimiter;
    private final RedisBlogVisitStore store;
    private final ViewExclusion exclusion;
    private final Clock clock;
    private final ZoneId zone;

    public BlogVisitRecordService(
            MemberQueryService members,
            VisitorKeyResolver visitorKeys,
            RateLimiter rateLimiter,
            RedisBlogVisitStore store,
            ViewProperties viewProperties,
            ResourceLoader resourceLoader,
            Clock clock,
            ZoneId serviceZoneId) {
        this.members = members;
        this.visitorKeys = visitorKeys;
        this.rateLimiter = rateLimiter;
        this.store = store;
        this.exclusion =
                ViewExclusion.fromResource(
                        resourceLoader.getResource(viewProperties.botUserAgentWords()));
        this.clock = clock;
        this.zone = serviceZoneId;
    }

    /**
     * @return 셌으면 true (중복이어도 HyperLogLog가 알아서 한 번만 센다), 뺐거나 건너뛰었으면 false
     * @throws com.team.blog.shared.error.TooManyRequestsException 같은 방문자 1분 {@value #RATE_LIMIT}번
     *     초과
     */
    public boolean recordVisit(Viewer viewer, String handle, VisitRequest request) {
        if (viewer.isAdmin()
                || exclusion.isBotOrPrefetch(
                        request.userAgent(), request.secPurpose(), request.purpose())) {
            return false;
        }
        Optional<BlogOwner> owner = members.findReadableBlogOwner(handle);
        if (owner.isEmpty() || viewer.isAuthorOf(owner.get().id())) {
            return false;
        }
        LocalDate today = LocalDate.now(clock.withZone(zone));
        try {
            Optional<String> visitorKey =
                    visitorKeys.resolve(
                            viewer, request.vid(), request.clientIp(), request.userAgent(), today);
            if (visitorKey.isEmpty()) {
                return false;
            }
            rateLimiter.acquireOrThrow(
                    RATE_LIMIT_PREFIX + visitorKey.get(), RATE_LIMIT, Duration.ofMinutes(1));
            store.recordVisit(today, owner.get().id(), visitorKey.get());
            return true;
        } catch (AutosaveUnavailableException e) {
            // Redis 메모리 부족 — 방문 기록은 건너뛴다
            return false;
        }
    }
}
