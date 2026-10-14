package com.team.blog.spellcheck.web;

import com.team.blog.shared.security.CurrentUser;
import com.team.blog.shared.web.CacheControlPolicy;
import com.team.blog.spellcheck.application.SpellCheckRequest;
import com.team.blog.spellcheck.application.SpellCheckService;
import com.team.blog.spellcheck.web.dto.SpellCheckResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * 맞춤법 검사 API (022 spec API). 현재 사용자는 세션에서만 얻는다(없으면 401). 글 번호는 문자열로 받아 숫자가 아니면 404다. 본문 길이 검사는 판정
 * 순서를 지키려고 Service가 한다.
 */
@RestController
public class SpellCheckController {

    private final SpellCheckService service;

    public SpellCheckController(SpellCheckService service) {
        this.service = service;
    }

    @PostMapping("/api/posts/{postId}/spell-check")
    public ResponseEntity<SpellCheckResponse> check(
            @CurrentUser Long memberId,
            @PathVariable String postId,
            @RequestBody(required = false) SpellCheckRequest body) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_STORE)
                .body(SpellCheckResponse.from(service.check(memberId, postId, body)));
    }
}
