package com.team.blog.stats.web;

import com.team.blog.shared.security.LoginRequired;
import com.team.blog.shared.security.Viewer;
import com.team.blog.shared.web.CacheControlPolicy;
import com.team.blog.stats.application.MyStats;
import com.team.blog.stats.application.MyStatsService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 내 둥지 통계 {@code GET /api/me/stats}. 로그인한 본인 것만, 응답은 {@code no-store}. */
@RestController
public class MyStatsController {

    private final MyStatsService service;

    public MyStatsController(MyStatsService service) {
        this.service = service;
    }

    @LoginRequired
    @GetMapping("/api/me/stats")
    public ResponseEntity<MyStats> get(Viewer viewer) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_STORE)
                .body(service.get(viewer));
    }
}
