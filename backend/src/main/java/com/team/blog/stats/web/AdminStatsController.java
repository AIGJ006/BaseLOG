package com.team.blog.stats.web;

import com.team.blog.shared.security.LoginRequired;
import com.team.blog.shared.security.Viewer;
import com.team.blog.shared.web.CacheControlPolicy;
import com.team.blog.stats.application.AdminStats;
import com.team.blog.stats.application.AdminStatsService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/** 관리자 통계 {@code GET /api/admin/stats} (024). 관리자만, 아니면 404. 응답은 {@code no-store}. */
@RestController
public class AdminStatsController {

    private final AdminStatsService service;

    public AdminStatsController(AdminStatsService service) {
        this.service = service;
    }

    @LoginRequired
    @GetMapping("/api/admin/stats")
    public ResponseEntity<AdminStats> get(Viewer viewer) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_STORE)
                .body(service.get(viewer));
    }
}
