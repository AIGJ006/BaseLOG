package com.team.blog.post.web;

import com.team.blog.post.application.PostPinService;
import com.team.blog.post.application.PostPinService.PinResult;
import com.team.blog.shared.security.Viewer;
import com.team.blog.shared.web.CacheControlPolicy;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 고정 글 (028). {@code PUT}은 고정, {@code DELETE}는 해제이고 둘 다 {@code {pinned, pinnedAt}}을 돌려준다. 응답은 항상
 * {@code Cache-Control: private, no-store}. 글 번호가 숫자가 아니거나 1 미만이면 없는 글(404)로 넘긴다.
 */
@RestController
public class PostPinController {

    private final PostPinService pinService;

    public PostPinController(PostPinService pinService) {
        this.pinService = pinService;
    }

    @PutMapping("/api/posts/{postId}/pin")
    public ResponseEntity<PinResult> pin(Viewer viewer, @PathVariable("postId") String postId) {
        return ok(pinService.pin(viewer, parseId(postId)));
    }

    @DeleteMapping("/api/posts/{postId}/pin")
    public ResponseEntity<PinResult> unpin(Viewer viewer, @PathVariable("postId") String postId) {
        return ok(pinService.unpin(viewer, parseId(postId)));
    }

    private static ResponseEntity<PinResult> ok(PinResult result) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, CacheControlPolicy.NO_STORE)
                .body(result);
    }

    /** 숫자가 아니거나 범위 밖이면 0 — 어떤 글과도 맞지 않아 404가 된다. */
    private static long parseId(String raw) {
        try {
            long id = Long.parseLong(raw);
            return id >= 1 ? id : 0;
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
