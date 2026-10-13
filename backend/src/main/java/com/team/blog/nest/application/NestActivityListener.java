package com.team.blog.nest.application;

import com.team.blog.shared.event.CommentCreated;
import com.team.blog.shared.event.PostLiked;
import com.team.blog.shared.event.PostPublished;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 글·댓글·좋아요 이벤트 → 둥지 포인트 (021 FR-020~FR-025). 커밋 뒤 비동기로 받는다. 실패해도 원래 행동에는 영향이 없다 — 번호만 WARN으로 남긴다.
 */
@Component
public class NestActivityListener {

    private static final Logger log = LoggerFactory.getLogger(NestActivityListener.class);

    private final NestPointService points;

    public NestActivityListener(NestPointService points) {
        this.points = points;
    }

    @Async("eventExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(PostPublished e) {
        runSafely("PostPublished", e.postId(), () -> points.grantPost(e.authorId(), e.postId()));
    }

    @Async("eventExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(CommentCreated e) {
        runSafely(
                "CommentCreated",
                e.commentId(),
                () -> points.grantComment(e.authorId(), e.commentId()));
    }

    @Async("eventExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(PostLiked e) {
        runSafely(
                "PostLiked",
                e.postId(),
                () -> points.grantLike(e.postAuthorId(), e.postId(), e.memberId()));
    }

    private static void runSafely(String event, long targetId, Runnable work) {
        try {
            work.run();
        } catch (RuntimeException ex) {
            log.warn(
                    "둥지 포인트 처리 실패: event={}, targetId={}, error={}",
                    event,
                    targetId,
                    ex.getClass().getSimpleName());
        }
    }
}
