package com.team.blog.stats.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.jayway.jsonpath.JsonPath;
import com.team.blog.stats.application.VisitFlushJob;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
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

/** 둥지 방문 기록 {@code POST /api/members/{handle}/visits}와 내 둥지 통계의 방문자 (031). */
class BlogVisitApiIT extends IntegrationTestBase {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    @Autowired VisitFlushJob flushJob;

    private long owner;
    private Cookie ownerSession;

    @BeforeEach
    void setUp() {
        owner = members().member().handle("nest01").create();
        ownerSession = TestLogin.loginAs(mockMvc, owner);
    }

    private MvcResult visit(String handle, Cookie session, Cookie... cookies) throws Exception {
        MockHttpServletRequestBuilder request =
                TestLogin.withCsrf(post("/api/members/" + handle + "/visits"), session)
                        .header(HttpHeaders.USER_AGENT, "Mozilla/5.0");
        if (cookies.length > 0) {
            request.cookie(cookies);
        }
        return mockMvc.perform(request).andReturn();
    }

    private String myStats(Cookie session) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/me/stats").cookie(session)).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private static long number(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    private static Cookie newVid() {
        return new Cookie("vid", UUID.randomUUID().toString());
    }

    @Test
    void 둥지마다_방문자를_하루_한_번씩_센다() throws Exception {
        long otherOwner = members().member().handle("nest02").create();
        Cookie guest = newVid();
        for (int i = 0; i < 3; i++) {
            assertThat(visit("nest01", null, guest).getResponse().getStatus()).isEqualTo(204);
        }
        visit("nest02", null, guest);
        Cookie member = TestLogin.loginAs(mockMvc, members().member().create());
        visit("nest01", member);
        visit("nest01", member);

        String mine = myStats(ownerSession);
        assertThat(number(mine, "$.visitors.today")).isEqualTo(2);
        assertThat(number(mine, "$.visitors.last7Days")).isEqualTo(2);
        assertThat(number(mine, "$.daily[29].visitors")).isEqualTo(2);
        assertThat(number(myStats(TestLogin.loginAs(mockMvc, otherOwner)), "$.visitors.today"))
                .isEqualTo(1);
    }

    @Test
    void 주인_본인과_관리자와_봇은_세지_않는다() throws Exception {
        visit("nest01", ownerSession);
        Cookie admin =
                TestLogin.loginAs(
                        mockMvc, members().member().handle("admin01").role("ADMIN").create());
        visit("nest01", admin);
        mockMvc.perform(
                TestLogin.withCsrf(post("/api/members/nest01/visits"), null)
                        .header(HttpHeaders.USER_AGENT, "Googlebot/2.1")
                        .cookie(newVid()));

        assertThat(number(myStats(ownerSession), "$.visitors.today")).isZero();
    }

    @Test
    void 없는_둥지도_204로_조용히_넘어간다() throws Exception {
        assertThat(visit("nobody99", null, newVid()).getResponse().getStatus()).isEqualTo(204);
    }

    @Test
    void 쿠키가_없는_비회원에게_vid를_주고_그_값으로_센다() throws Exception {
        Cookie given = visit("nest01", null).getResponse().getCookie("vid");
        assertThat(given).isNotNull();
        visit("nest01", null, new Cookie("vid", given.getValue()));

        assertThat(number(myStats(ownerSession), "$.visitors.today")).isEqualTo(1);
    }

    @Test
    void 옮긴_수는_DB에_남고_누적에_더해진다() throws Exception {
        LocalDate today = LocalDate.now(SEOUL);
        jdbc.update(
                "INSERT INTO blog_visit_daily (owner_id, visit_date, visitors) VALUES (?, ?, 7), (?, ?, 5)",
                owner,
                today.minusDays(40),
                owner,
                today.minusDays(1));
        visit("nest01", null, newVid());
        flushJob.flush(today);

        assertThat(
                        jdbc.queryForObject(
                                "SELECT visitors FROM blog_visit_daily WHERE owner_id = ? AND visit_date = ?",
                                Long.class,
                                owner,
                                today))
                .isEqualTo(1);
        String json = myStats(ownerSession);
        assertThat(number(json, "$.visitors.today")).isEqualTo(1);
        assertThat(number(json, "$.visitors.last7Days")).isEqualTo(6);
        assertThat(number(json, "$.visitors.last30Days")).isEqualTo(6);
        assertThat(number(json, "$.visitors.total")).isEqualTo(13);
        assertThat(number(json, "$.daily[28].visitors")).isEqualTo(5);
    }
}
