package com.team.blog.inquiry.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.jayway.jsonpath.JsonPath;
import com.team.blog.inquiry.application.InquiryService;
import com.team.blog.notification.support.NotificationAwait;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 문의·신고 보내기·내가 보낸 문의·관리자 답변과 알림 (023). */
class InquiryApiIT extends IntegrationTestBase {

    @Autowired
    @Qualifier("eventExecutor")
    private ThreadPoolTaskExecutor eventExecutor;

    private long me;
    private long admin;
    private Cookie session;
    private Cookie adminSession;
    private NotificationAwait awaiter;

    @BeforeEach
    void setUp() {
        me = members().member().handle("asker01").create();
        admin = members().member().handle("admin01").role("ADMIN").create();
        session = TestLogin.loginAs(mockMvc, me);
        adminSession = TestLogin.loginAs(mockMvc, admin);
        awaiter = new NotificationAwait(jdbc, eventExecutor);
    }

    private MvcResult send(MockHttpServletRequestBuilder request, Cookie cookie, String json)
            throws Exception {
        return mockMvc.perform(
                        TestLogin.withCsrf(request, cookie)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json))
                .andReturn();
    }

    private MvcResult perform(MockHttpServletRequestBuilder request, Cookie cookie)
            throws Exception {
        if (cookie != null) {
            request.cookie(cookie);
        }
        return mockMvc.perform(request).andReturn();
    }

    private static String body(MvcResult result) {
        return new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
    }

    private static <T> T read(MvcResult result, String path) {
        return JsonPath.read(body(result), path);
    }

    private MvcResult create(String json) throws Exception {
        return send(post("/api/me/inquiries"), session, json);
    }

    private long createdId(MvcResult result) {
        assertThat(result.getResponse().getStatus()).as(body(result)).isEqualTo(201);
        return ((Number) read(result, "$.id")).longValue();
    }

    /** 완료 확인까지 마친 글 사진 한 장. */
    private long image(long uploader, String key) {
        return jdbc.queryForObject(
                "INSERT INTO image (uploader_id, storage_key, content_type, size_bytes, width, height)"
                        + " VALUES (?, ?, 'image/png', 100, 10, 10) RETURNING id",
                Long.class,
                uploader,
                key);
    }

    @Test
    void 문의를_보내면_접수_상태로_내가_보낸_문의_맨_위에_보인다() throws Exception {
        createdId(create("{\"category\":\"BUG\",\"content\":\"첫 문의\"}"));
        MvcResult created =
                create(
                        "{\"category\":\"USER_REPORT\",\"content\":\"광고만 올려요\","
                                + "\"targetHandle\":\"@Spam_Man\"}");
        createdId(created);
        assertThat(created.getResponse().getHeader("Cache-Control")).isEqualTo("private, no-store");
        assertThat((String) read(created, "$.status")).isEqualTo("RECEIVED");
        assertThat((String) read(created, "$.targetHandle")).isEqualTo("spam_man");
        assertThat((Object) read(created, "$.answer")).isNull();

        MvcResult mine = perform(get("/api/me/inquiries"), session);
        assertThat(mine.getResponse().getStatus()).isEqualTo(200);
        assertThat((List<String>) read(mine, "$.items[*].content"))
                .containsExactly("광고만 올려요", "첫 문의");
    }

    @Test
    void 비회원은_401() throws Exception {
        assertThat(send(post("/api/me/inquiries"), null, "{}").getResponse().getStatus())
                .isEqualTo(401);
        assertThat(perform(get("/api/me/inquiries"), null).getResponse().getStatus())
                .isEqualTo(401);
    }

    @Test
    void 형식이_틀리면_칸_오류_목록() throws Exception {
        MvcResult result = create("{\"category\":\"NOPE\",\"content\":\"\"}");
        assertThat(result.getResponse().getStatus()).isEqualTo(400);
        assertThat((String) read(result, "$.code")).isEqualTo("VALIDATION_FAILED");
        assertThat((List<String>) read(result, "$.errors[*].field"))
                .containsExactly("category", "content");
    }

    @Test
    void 내_사진은_붙고_남의_사진은_안_붙는다() throws Exception {
        long mine = image(me, "posts/mine.png");
        MvcResult ok = create("{\"category\":\"BUG\",\"content\":\"사진\",\"imageId\":" + mine + "}");
        createdId(ok);
        assertThat((String) read(ok, "$.imageUrl")).endsWith("/posts/mine.png");
        assertThat(jdbc.queryForObject("SELECT status FROM image WHERE id = ?", String.class, mine))
                .isEqualTo("ATTACHED");

        long other = image(admin, "posts/other.png");
        MvcResult rejected =
                create("{\"category\":\"BUG\",\"content\":\"사진\",\"imageId\":" + other + "}");
        assertThat(rejected.getResponse().getStatus()).isEqualTo(400);
        assertThat((List<String>) read(rejected, "$.errors[*].field")).containsExactly("imageId");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM inquiry", Long.class)).isEqualTo(1);
    }

    @Test
    void 하루_한도를_넘으면_429() throws Exception {
        for (int i = 0; i < InquiryService.PER_DAY; i++) {
            createdId(create("{\"category\":\"OTHER\",\"content\":\"문의 " + i + "\"}"));
        }
        MvcResult over = create("{\"category\":\"OTHER\",\"content\":\"하나 더\"}");
        assertThat(over.getResponse().getStatus()).isEqualTo(429);
        assertThat((String) read(over, "$.code")).isEqualTo("TOO_MANY_REQUESTS");
        assertThat((List<?>) read(over, "$.errors")).isEmpty();
    }

    @Test
    void 일반_회원은_관리자_문의_API를_볼_수_없다() throws Exception {
        assertThat(perform(get("/api/admin/inquiries"), session).getResponse().getStatus())
                .isEqualTo(404);
    }

    @Test
    void 관리자가_답하면_답변_완료가_되고_한_번만_알린다() throws Exception {
        long id = createdId(create("{\"category\":\"ACCOUNT\",\"content\":\"비밀번호를 잊었어요\"}"));

        MvcResult list =
                perform(get("/api/admin/inquiries").param("status", "RECEIVED"), adminSession);
        assertThat(list.getResponse().getStatus()).isEqualTo(200);
        assertThat((List<String>) read(list, "$.items[*].member.handle"))
                .containsExactly("asker01");

        MvcResult answered =
                send(
                        put("/api/admin/inquiries/{id}/answer", id),
                        adminSession,
                        "{\"answer\":\"비밀번호 찾기를 써 주세요\"}");
        assertThat(answered.getResponse().getStatus()).as(body(answered)).isEqualTo(200);
        assertThat((String) read(answered, "$.status")).isEqualTo("ANSWERED");
        awaiter.untilCount(me, 1);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT type FROM notification WHERE receiver_id = ?",
                                String.class,
                                me))
                .isEqualTo("INQUIRY_ANSWERED");

        // 답을 고쳐도 다시 알리지 않는다
        MvcResult edited =
                send(
                        post("/api/admin/inquiries/{id}/answer", id),
                        adminSession,
                        "{\"answer\":\"설정에서 바꿀 수 있어요\"}");
        assertThat(edited.getResponse().getStatus()).isEqualTo(200);
        awaiter.idle();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM notification WHERE receiver_id = ?",
                                Long.class,
                                me))
                .isEqualTo(1);

        MvcResult mine = perform(get("/api/me/inquiries"), session);
        assertThat((String) read(mine, "$.items[0].answer")).isEqualTo("설정에서 바꿀 수 있어요");
        assertThat((String) read(mine, "$.items[0].status")).isEqualTo("ANSWERED");

        MvcResult notifications = perform(get("/api/notifications"), session);
        assertThat((String) read(notifications, "$.items[0].url")).isEqualTo("/support?tab=mine");
        assertThat((Object) read(notifications, "$.items[0].actor")).isNull();

        MvcResult pending =
                perform(get("/api/admin/inquiries").param("status", "RECEIVED"), adminSession);
        assertThat((List<?>) read(pending, "$.items")).isEmpty();
    }

    @Test
    void 관리자는_문의_하나를_열어_볼_수_있다() throws Exception {
        long id = createdId(create("{\"category\":\"BUG\",\"content\":\"사진이 안 올라가요\"}"));

        MvcResult one = perform(get("/api/admin/inquiries/{id}", id), adminSession);
        assertThat(one.getResponse().getStatus()).as(body(one)).isEqualTo(200);
        assertThat((String) read(one, "$.content")).isEqualTo("사진이 안 올라가요");
        assertThat((String) read(one, "$.status")).isEqualTo("RECEIVED");
        assertThat((String) read(one, "$.member.handle")).isEqualTo("asker01");
        assertThat(
                        perform(get("/api/admin/inquiries/999999"), adminSession)
                                .getResponse()
                                .getStatus())
                .isEqualTo(404);
        assertThat(perform(get("/api/admin/inquiries/{id}", id), session).getResponse().getStatus())
                .isEqualTo(404);
    }

    @Test
    void 없는_문의에_답하면_404() throws Exception {
        assertThat(
                        send(
                                        put("/api/admin/inquiries/999999/answer"),
                                        adminSession,
                                        "{\"answer\":\"x\"}")
                                .getResponse()
                                .getStatus())
                .isEqualTo(404);
    }
}
