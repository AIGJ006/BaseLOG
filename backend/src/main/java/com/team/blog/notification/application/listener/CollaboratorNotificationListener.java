package com.team.blog.notification.application.listener;

import com.team.blog.notification.application.NotificationWriter;
import com.team.blog.shared.event.CollaboratorAdded;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** 알림 리스너: 공동 작업자 추가 (030 {@code CollaboratorAdded}). 커밋 뒤 비동기, 실패는 WARN만. */
@Component
public class CollaboratorNotificationListener {

    private final NotificationWriter writer;

    public CollaboratorNotificationListener(NotificationWriter writer) {
        this.writer = writer;
    }

    @Async("eventExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(CollaboratorAdded e) {
        ListenerSupport.runSafely(
                "CollaboratorAdded", e.collaboratorId(), () -> writer.addCollaboratorAdded(e));
    }
}
