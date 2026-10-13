package com.team.blog.nest.web;

import com.team.blog.account.application.BlogOwner;
import com.team.blog.account.application.MemberQueryService;
import com.team.blog.nest.application.NestQueryService;
import com.team.blog.nest.application.NestView;
import com.team.blog.shared.error.NotFoundException;
import com.team.blog.shared.web.CacheControlPolicy;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * 회원의 둥지 모습 (021 contracts {@code getMemberNest}) — 둥지 화면 오른쪽과 글 상세 작성자 카드가 쓴다. 누구나 본다. 주인은 001
 * {@link MemberQueryService#findReadableBlogOwner}로 찾는다 — 없음·탈퇴 유예·익명 처리는 같은 404.
 */
@RestController
public class MemberNestController {

    private final MemberQueryService members;
    private final NestQueryService queries;

    public MemberNestController(MemberQueryService members, NestQueryService queries) {
        this.members = members;
        this.queries = queries;
    }

    @GetMapping("/api/members/{handle}/nest")
    public ResponseEntity<NestView> nest(@PathVariable String handle) {
        BlogOwner owner =
                members.findReadableBlogOwner(handle)
                        .orElseThrow(
                                () -> new NotFoundException("nest owner not found: " + handle));
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_CACHE)
                .body(queries.publicNest(owner.id()));
    }
}
