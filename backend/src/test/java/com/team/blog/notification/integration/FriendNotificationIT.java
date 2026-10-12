package com.team.blog.notification.integration;

import static com.team.blog.notification.support.NotificationApi.body;
import static com.team.blog.notification.support.NotificationApi.read;
import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.notification.support.NotificationActions;
import com.team.blog.notification.support.NotificationApi;
import com.team.blog.notification.support.NotificationTestBase;
import com.team.blog.support.TestLogin;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 친구 요청·수락 알림 (020, 옛 011 새 팔로워 알림 자리). 친구 API를 실제로 거쳐 {@code FriendRequested}·{@code
 * FriendAccepted}가 커밋 뒤 알림이 되는지 본다. 거절·취소·끊기는 알리지 않는다.
 */
class FriendNotificationIT extends NotificationTestBase {

    private NotificationActions actions;
    private NotificationApi api;
    private long a;
    private long b;

    @BeforeEach
    void setUp() {
        actions = new NotificationActions(mockMvc, jdbc);
        api = new NotificationApi(mockMvc);
        a = members().member().handle("friend_a").nickname("친구에이").create();
        b = members().member().handle("friend_b").nickname("친구비").create();
    }

    private Map<String, Object> first(long receiver) throws Exception {
        Cookie session = TestLogin.loginAs(mockMvc, receiver);
        MvcResult result = api.list(session, 10, null);
        assertThat(result.getResponse().getStatus()).as(body(result)).isEqualTo(200);
        return read(result, "$.items[0]");
    }

    @Test
    @SuppressWarnings("unchecked")
    void 요청하면_받은_사람에게_수락하면_요청한_사람에게() throws Exception {
        actions.requestFriend(a, b);
        awaiter.untilCount(b, 1);
        Map<String, Object> request = first(b);
        assertThat(request.get("type")).isEqualTo("FRIEND_REQUEST");
        assertThat(((Map<String, Object>) request.get("actor")).get("handle"))
                .isEqualTo("friend_a");
        assertThat(request.get("url")).isEqualTo("/settings#friends");
        assertThat(notifications.count(a)).isZero();

        actions.requestFriend(b, a);
        awaiter.untilCount(a, 1);
        Map<String, Object> accepted = first(a);
        assertThat(accepted.get("type")).isEqualTo("FRIEND_ACCEPTED");
        assertThat(((Map<String, Object>) accepted.get("actor")).get("handle"))
                .isEqualTo("friend_b");
        assertThat(accepted.get("url")).isEqualTo("/@friend_b");
        awaiter.idle();
        assertThat(notifications.count(b)).as("수락한 쪽은 새 알림 없음").isEqualTo(1);
    }

    @Test
    void 요청_취소_다시_요청해도_안_읽은_요청_알림은_하나() throws Exception {
        actions.requestFriend(a, b);
        awaiter.untilCount(b, 1);
        actions.removeFriend(a, b);
        actions.requestFriend(a, b);
        awaiter.idle();
        assertThat(notifications.count(b, "FRIEND_REQUEST")).isEqualTo(1);
    }

    @Test
    void 거절_끊기는_알리지_않는다() throws Exception {
        actions.requestFriend(a, b);
        awaiter.untilCount(b, 1);
        actions.removeFriend(b, a);
        actions.requestFriend(b, a);
        awaiter.untilCount(a, 1);
        actions.requestFriend(a, b);
        awaiter.idle();
        long before = notifications.count(a) + notifications.count(b);

        actions.removeFriend(a, b);
        awaiter.idle();

        assertThat(notifications.count(a) + notifications.count(b)).isEqualTo(before);
    }

    @Test
    void 끈_종류는_만들지_않는다() throws Exception {
        notifications.mute(b, "FRIEND_REQUEST");
        notifications.mute(a, "FRIEND_ACCEPTED");
        actions.requestFriend(a, b);
        actions.requestFriend(b, a);
        awaiter.idle();
        assertThat(notifications.count(a)).isZero();
        assertThat(notifications.count(b)).isZero();
    }
}
