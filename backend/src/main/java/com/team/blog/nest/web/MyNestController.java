package com.team.blog.nest.web;

import com.team.blog.nest.application.AttendanceResult;
import com.team.blog.nest.application.MyNestView;
import com.team.blog.nest.application.NestQueryService;
import com.team.blog.nest.application.NestService;
import com.team.blog.nest.application.PointHistoryView;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.security.CurrentUser;
import com.team.blog.shared.web.CacheControlPolicy;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 내 둥지 꾸미기 (021 contracts {@code getMyNest}·{@code attend}·{@code listMyNestPoints}·{@code
 * buyNestItem}·{@code equipNest}). 현재 사용자는 세션에서만 꺼낸다. 응답은 항상 {@code Cache-Control: private,
 * no-store}.
 */
@RestController
public class MyNestController {

    private final NestService nestService;
    private final NestQueryService queryService;

    public MyNestController(NestService nestService, NestQueryService queryService) {
        this.nestService = nestService;
        this.queryService = queryService;
    }

    /**
     * @param background 배경 코드 ({@code null}이면 기본 숲)
     * @param nestType 둥지 코드 ({@code null}이면 기본 둥지)
     * @param decorations 새 장식 코드들 (없으면 모두 내림)
     */
    public record EquipRequest(String background, String nestType, List<String> decorations) {}

    /**
     * @param show 내 둥지 프로필에 새를 보이나 (빠지면 400 — 빈 요청이 설정을 꺼 버리지 않게)
     */
    public record ShowOnBlogRequest(Boolean show) {}

    @GetMapping("/api/me/nest")
    public ResponseEntity<MyNestView> myNest(@CurrentUser Long memberId) {
        return noStore(HttpStatus.OK, queryService.myNest(memberId));
    }

    /** 오늘 출석 — 같은 날 다시 불러도 200이고 {@code attended: false}. */
    @PostMapping("/api/me/nest/attendance")
    public ResponseEntity<AttendanceResult> attend(@CurrentUser Long memberId) {
        return noStore(HttpStatus.OK, nestService.attend(memberId));
    }

    /** 포인트 기록 (새것부터 30개씩). {@code before}가 숫자가 아니면 첫 쪽. */
    @GetMapping("/api/me/nest/points")
    public ResponseEntity<PointHistoryView> points(
            @CurrentUser Long memberId, @RequestParam(required = false) String before) {
        return noStore(HttpStatus.OK, queryService.history(memberId, parseBefore(before)));
    }

    @PostMapping("/api/me/nest/items/{code}")
    public ResponseEntity<MyNestView> buy(@CurrentUser Long memberId, @PathVariable String code) {
        return noStore(HttpStatus.OK, nestService.buy(memberId, code));
    }

    @PutMapping("/api/me/nest/equipped")
    public ResponseEntity<MyNestView> equip(
            @CurrentUser Long memberId, @RequestBody EquipRequest request) {
        return noStore(
                HttpStatus.OK,
                nestService.equip(
                        memberId, request.background(), request.nestType(), request.decorations()));
    }

    /** 내 둥지 프로필에 새 보이기 켜고 끄기 (설정 > 프로필). */
    @PutMapping("/api/me/nest/show-on-blog")
    public ResponseEntity<MyNestView> showOnBlog(
            @CurrentUser Long memberId, @RequestBody ShowOnBlogRequest request) {
        if (request.show() == null) {
            throw ValidationException.of("show", "REQUIRED", "켜기 또는 끄기를 골라 주세요");
        }
        return noStore(HttpStatus.OK, nestService.showOnBlog(memberId, request.show()));
    }

    private static <T> ResponseEntity<T> noStore(HttpStatus status, T body) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_STORE)
                .body(body);
    }

    static Long parseBefore(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            long id = Long.parseLong(raw);
            return id >= 1 ? id : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
