package com.team.blog.notification.application.listener;

import com.team.blog.notification.application.NotificationWriter;
import com.team.blog.shared.event.InquiryAnswered;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

/** 알림 리스너: 문의 답변 (023 {@code InquiryAnswered}). 커밋 뒤 비동기, 실패는 WARN만. */
@Component
public class InquiryNotificationListener {

    private final NotificationWriter writer;

    public InquiryNotificationListener(NotificationWriter writer) {
        this.writer = writer;
    }

    @Async("eventExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(InquiryAnswered e) {
        ListenerSupport.runSafely(
                "InquiryAnswered", e.inquiryId(), () -> writer.addInquiryAnswered(e));
    }
}
