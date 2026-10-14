package com.team.blog.nest.web;

import com.team.blog.nest.application.MyNestView;
import com.team.blog.nest.application.NestService;
import com.team.blog.shared.security.CurrentUser;
import com.team.blog.shared.web.CacheControlPolicy;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 새 키우기 시험용 칸 (2026-10-14 민서 요청). 내 새 단계를 바로 바꾸고 포인트를 넣는다. {@code blog.nest.dev-tools=true}일 때만 생긴다
 * — 로컬 프로필({@code application-local.yml})만 켜고, 운영에는 이 주소가 없다(404).
 */
@RestController
@ConditionalOnProperty(prefix = "blog.nest", name = "dev-tools", havingValue = "true")
public class NestDevController {

    private final NestService nestService;

    public NestDevController(NestService nestService) {
        this.nestService = nestService;
    }

    /**
     * @param level 새 단계 (1~4로 맞춘다)
     */
    public record LevelRequest(int level) {}

    /**
     * @param amount 넣을 포인트 (1~100000으로 맞춘다)
     */
    public record PointsRequest(int amount) {}

    @PutMapping("/api/me/nest/dev/level")
    public ResponseEntity<MyNestView> level(
            @CurrentUser Long memberId, @RequestBody LevelRequest request) {
        return noStore(nestService.setLevelForTesting(memberId, request.level()));
    }

    @PostMapping("/api/me/nest/dev/points")
    public ResponseEntity<MyNestView> points(
            @CurrentUser Long memberId, @RequestBody PointsRequest request) {
        return noStore(nestService.givePointsForTesting(memberId, request.amount()));
    }

    private static ResponseEntity<MyNestView> noStore(MyNestView body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_STORE)
                .body(body);
    }
}
