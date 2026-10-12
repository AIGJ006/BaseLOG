package com.team.blog.notification.application.listener;

import com.team.blog.notification.application.NotificationWriter;
import com.team.blog.shared.event.FriendAccepted;
import com.team.blog.shared.event.FriendRequested;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * 알림 리스너: 친구 요청·수락 (020, 001 contracts/events.md §1 — {@code FriendRequested}·{@code
 * FriendAccepted}). 커밋 뒤 비동기로 받고, 저장은 {@link NotificationWriter}의 자기 트랜잭션이 한다. 실패는 {@link
 * ListenerSupport#runSafely}가 잡아 WARN만 남긴다(FR-002). 거절·취소·끊기는 이벤트가 없어 알리지 않는다.
 */
@Component
public class FriendNotificationListener {

    private final NotificationWriter writer;

    public FriendNotificationListener(NotificationWriter writer) {
        this.writer = writer;
    }

    @Async("eventExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(FriendRequested e) {
        ListenerSupport.runSafely(
                "FriendRequested",
                e.receiverId(),
                () -> writer.addFriendRequest(e.receiverId(), e.requesterId()));
    }

    @Async("eventExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(FriendAccepted e) {
        ListenerSupport.runSafely(
                "FriendAccepted",
                e.requesterId(),
                () -> writer.addFriendAccepted(e.requesterId(), e.accepterId()));
    }
}
