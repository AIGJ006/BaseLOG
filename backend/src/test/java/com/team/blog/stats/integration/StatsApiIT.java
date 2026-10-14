package com.team.blog.stats.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.JsonPath;
import com.team.blog.stats.application.VisitFlushJob;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.PostFixtures;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 방문 기록 {@code POST /api/visits}와 관리자 통계 {@code GET /api/admin/stats} (024). */
class StatsApiIT extends IntegrationTestBase {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    @Autowired VisitFlushJob flushJob;

    private long admin;
    private Cookie adminSession;

    @BeforeEach
    void setUp() {
        admin = members().member().handle("admin01").role("ADMIN").create();
        adminSession = TestLogin.loginAs(mockMvc, admin);
    }

    private MvcResult perform(MockHttpServletRequestBuilder request, Cookie... cookies)
            throws Exception {
        if (cookies.length > 0) {
            request.cookie(cookies);
        }
        return mockMvc.perform(request).andReturn();
    }

    private MvcResult visit(Cookie session, Cookie... cookies) throws Exception {
        MockHttpServletRequestBuilder request =
                TestLogin.withCsrf(post("/api/visits"), session)
                        .header(HttpHeaders.USER_AGENT, "Mozilla/5.0");
        return perform(request, cookies);
    }

    private String stats() throws Exception {
        MvcResult result = perform(get("/api/admin/stats"), adminSession);
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private static long number(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    @Test
    void 방문자는_하루_한_번만_센다() throws Exception {
        Cookie vid = new Cookie("vid", UUID.randomUUID().toString());
        for (int i = 0; i < 3; i++) {
            assertThat(visit(null, vid).getResponse().getStatus()).isEqualTo(204);
        }
        long memberId = members().member().create();
        Cookie member = TestLogin.loginAs(mockMvc, memberId);
        visit(member);
        visit(member);

        String json = stats();
        assertThat(number(json, "$.visitors.today")).isEqualTo(2);
        assertThat(number(json, "$.daily[29].memberVisitors")).isEqualTo(1);
        assertThat((Integer) JsonPath.read(json, "$.daily.length()")).isEqualTo(30);
    }

    @Test
    void 쿠키가_없는_비회원에게_vid를_주고_그_값으로_센다() throws Exception {
        MvcResult first = visit(null);
        Cookie given = first.getResponse().getCookie("vid");
        assertThat(given).isNotNull();
        visit(null, new Cookie("vid", given.getValue()));

        assertThat(number(stats(), "$.visitors.today")).isEqualTo(1);
    }

    @Test
    void 관리자와_봇은_세지_않는다() throws Exception {
        visit(adminSession);
        perform(
                TestLogin.withCsrf(post("/api/visits"), null)
                        .header(HttpHeaders.USER_AGENT, "Googlebot/2.1"),
                new Cookie("vid", UUID.randomUUID().toString()));

        assertThat(number(stats(), "$.visitors.today")).isZero();
    }

    @Test
    void 옮긴_수는_DB에_남고_누적에_더해진다() throws Exception {
        LocalDate today = LocalDate.now(SEOUL);
        jdbc.update(
                "INSERT INTO site_visit_daily (visit_date, visitors, member_visitors) VALUES (?, 7, 2)",
                today.minusDays(40));
        jdbc.update(
                "INSERT INTO site_visit_daily (visit_date, visitors, member_visitors) VALUES (?, 5, 1)",
                today.minusDays(1));
        visit(null, new Cookie("vid", UUID.randomUUID().toString()));
        flushJob.flush(today);

        assertThat(
                        jdbc.queryForObject(
                                "SELECT visitors FROM site_visit_daily WHERE visit_date = ?",
                                Long.class,
                                today))
                .isEqualTo(1);
        String json = stats();
        assertThat(number(json, "$.visitors.today")).isEqualTo(1);
        assertThat(number(json, "$.visitors.yesterday")).isEqualTo(5);
        assertThat(number(json, "$.visitors.last7Days")).isEqualTo(6);
        assertThat(number(json, "$.visitors.total")).isEqualTo(13);
        assertThat((String) JsonPath.read(json, "$.visitors.since"))
                .isEqualTo(today.minusDays(40).toString());
    }

    @Test
    void 회원_글_조회수와_많이_본_글() throws Exception {
        long author = members().member().handle("writer01").create();
        PostFixtures posts = new PostFixtures(jdbc);
        long popular = posts.create(author, PostFixtures.State.PUBLISHED_PUBLIC);
        long secret = posts.create(author, PostFixtures.State.PUBLISHED_PRIVATE);
        LocalDate today = LocalDate.now(SEOUL);
        jdbc.update(
                "INSERT INTO post_view_daily (post_id, view_date, views) VALUES (?, ?, 9), (?, ?, 4)",
                popular,
                today,
                secret,
                today);

        String json = stats();
        assertThat(number(json, "$.members.total")).isEqualTo(2);
        assertThat(number(json, "$.members.today")).isEqualTo(2);
        assertThat(number(json, "$.posts.total")).isEqualTo(2);
        assertThat(number(json, "$.views.today")).isEqualTo(13);
        assertThat((Integer) JsonPath.read(json, "$.topPosts.length()")).isEqualTo(1);
        assertThat(number(json, "$.topPosts[0].postId")).isEqualTo(popular);
        assertThat((String) JsonPath.read(json, "$.topPosts[0].handle")).isEqualTo("writer01");
    }

    @Test
    void 일반_회원과_비로그인은_볼_수_없다() throws Exception {
        Cookie member = TestLogin.loginAs(mockMvc, members().member().create());
        assertThat(perform(get("/api/admin/stats"), member).getResponse().getStatus())
                .isEqualTo(404);
        assertThat(perform(get("/api/admin/stats")).getResponse().getStatus()).isEqualTo(401);
    }
}
