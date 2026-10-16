package com.team.blog.post.application;

import com.team.blog.post.domain.PostNotFoundException;
import com.team.blog.post.domain.PostReasonCode;
import com.team.blog.post.domain.PostStatus;
import com.team.blog.post.infra.PostPinRepository;
import com.team.blog.post.infra.PostPinRepository.PinTarget;
import com.team.blog.shared.error.ApiException;
import com.team.blog.shared.error.CommonReasonCode;
import com.team.blog.shared.security.AccountStatusGuard;
import com.team.blog.shared.security.ActionKind;
import com.team.blog.shared.security.Viewer;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 고정 글 (029, {@code PUT·DELETE /api/posts/{postId}/pin}). 글쓴이가 자기 등록 글을 둥지 글 목록 맨 위에 고정한다.
 *
 * <p>판정 순서는 공개 범위 변경(004)과 같다: ① 비회원 401 → ② 계정 상태({@link ActionKind#CONTENT_WRITE}) → ③ 내 휴지통 밖
 * 글(없음·남의 글·휴지통 글은 같은 404, 관리자 예외 없음) → ④ 임시글이면 409 {@code PIN_NOT_PUBLISHED} → ⑤ 이미 {@value
 * #MAX_PINNED}개면 409 {@code PIN_LIMIT_EXCEEDED}.
 *
 * <ul>
 *   <li>이미 고정한 글을 다시 고정하거나, 고정 안 한 글을 해제하면 바꾸지 않고 지금 상태를 돌려준다(같은 요청을 두 번 보내도 같다).
 *   <li>공개 범위는 보지 않는다 — 비공개·친구 공개 글도 고정할 수 있고, 목록에 보이는지는 기존 공개 범위 규칙을 그대로 따른다.
 *   <li>휴지통으로 옮기면 고정이 풀린다({@code TrashPostRepository#markTrashed}).
 * </ul>
 */
@Service
public class PostPinService {

    private static final Logger log = LoggerFactory.getLogger(PostPinService.class);

    /** 한 둥지의 고정 글 최대 개수. */
    public static final int MAX_PINNED = 3;

    /** 고정 결과 (응답 {@code {pinned, pinnedAt}}). */
    public record PinResult(boolean pinned, Instant pinnedAt) {}

    private final AccountStatusGuard accountStatusGuard;
    private final PostPinRepository pins;
    private final Clock clock;

    public PostPinService(
            AccountStatusGuard accountStatusGuard, PostPinRepository pins, Clock clock) {
        this.accountStatusGuard = accountStatusGuard;
        this.pins = pins;
        this.clock = clock;
    }

    @Transactional
    public PinResult pin(Viewer viewer, long postId) {
        long me = requireWriter(viewer);
        pins.lockAuthor(me);
        PinTarget post = requireOwned(postId, me);
        if (post.status() != PostStatus.PUBLISHED) {
            throw new ApiException(PostReasonCode.PIN_NOT_PUBLISHED);
        }
        if (post.pinnedAt() != null) {
            return new PinResult(true, post.pinnedAt());
        }
        if (pins.countPinned(me) >= MAX_PINNED) {
            throw new ApiException(PostReasonCode.PIN_LIMIT_EXCEEDED);
        }
        Instant now = PostCommandService.now(clock);
        pins.setPinnedAt(postId, now);
        log.info("글 고정: postId={} authorId={}", postId, me);
        return new PinResult(true, now);
    }

    @Transactional
    public PinResult unpin(Viewer viewer, long postId) {
        long me = requireWriter(viewer);
        PinTarget post = requireOwned(postId, me);
        if (post.pinnedAt() != null) {
            pins.setPinnedAt(postId, null);
            log.info("글 고정 해제: postId={} authorId={}", postId, me);
        }
        return new PinResult(false, null);
    }

    private long requireWriter(Viewer viewer) {
        if (viewer == null || !viewer.isAuthenticated()) {
            throw new ApiException(CommonReasonCode.LOGIN_REQUIRED);
        }
        long me = viewer.id();
        accountStatusGuard.requireActive(me, ActionKind.CONTENT_WRITE);
        return me;
    }

    private PinTarget requireOwned(long postId, long me) {
        return pins.lockOwned(postId, me)
                .orElseThrow(() -> new PostNotFoundException("고정: 내 글 아님"));
    }
}
