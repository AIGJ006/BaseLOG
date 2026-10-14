package com.team.blog.notification.unit;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.notification.domain.GroupKey;
import com.team.blog.notification.domain.MutableType;
import com.team.blog.notification.domain.NotificationType;
import java.util.Arrays;
import org.junit.jupiter.api.Test;

/**
 * 알림 종류·끌 수 있는 종류·묶음 키 (011 T008, data-model §2, 020 친구 알림, 023 문의 답변). V12 CHECK와의 비교는 {@code
 * NotificationTypeSchemaIT}.
 */
class NotificationTypeTest {

    @Test
    void 운영_알림은_세_종류() {
        assertThat(Arrays.stream(NotificationType.values()).filter(NotificationType::isOperational))
                .containsExactly(
                        NotificationType.REPORT_RESOLVED,
                        NotificationType.CONTENT_HIDDEN,
                        NotificationType.INQUIRY_ANSWERED);
    }

    @Test
    void 묶음은_좋아요뿐() {
        assertThat(Arrays.stream(NotificationType.values()).filter(NotificationType::isGrouped))
                .containsExactly(NotificationType.LIKE);
    }

    @Test
    void 글을_읽을_수_있어야_하는_종류() {
        assertThat(
                        Arrays.stream(NotificationType.values())
                                .filter(NotificationType::needsReadablePost))
                .containsExactly(
                        NotificationType.COMMENT,
                        NotificationType.REPLY,
                        NotificationType.LIKE,
                        NotificationType.NEW_POST);
    }

    @Test
    void 끌_수_있는_종류는_운영_알림이_아닌_여섯() {
        assertThat(MutableType.values()).hasSize(6);
        for (NotificationType type : NotificationType.values()) {
            if (type.isOperational()) {
                assertThat(type.mutable()).isNull();
            } else {
                assertThat(type.mutable().type()).isEqualTo(type);
            }
        }
    }

    @Test
    void 묶음_키() {
        assertThat(GroupKey.like(41).value()).isEqualTo("LIKE:post:41");
    }
}
