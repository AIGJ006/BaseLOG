package com.team.blog.stats.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.jayway.jsonpath.JsonPath;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.PostFixtures;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** 내 둥지 통계 {@code GET /api/me/stats} (2026-10-15). */
class MyStatsApiIT extends IntegrationTestBase {

    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private static long number(String json, String path) {
        return ((Number) JsonPath.read(json, path)).longValue();
    }

    private String stats(Cookie session) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/me/stats").cookie(session)).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    @Test
    void 내_글만_세고_내가_누른_좋아요와_내_댓글은_뺀다() throws Exception {
        long me = members().member().handle("mine01").create();
        long other = members().member().handle("other01").create();
        PostFixtures posts = new PostFixtures(jdbc);
        long popular = posts.create(me, PostFixtures.State.PUBLISHED_PUBLIC);
        long secret = posts.create(me, PostFixtures.State.PUBLISHED_PRIVATE);
        long othersPost = posts.create(other, PostFixtures.State.PUBLISHED_PUBLIC);
        LocalDate today = LocalDate.now(SEOUL);
        jdbc.update(
                "INSERT INTO post_view_daily (post_id, view_date, views) VALUES"
                        + " (?, ?, 9), (?, ?, 4), (?, ?, 3), (?, ?, 50)",
                popular,
                today,
                popular,
                today.minusDays(10),
                secret,
                today,
                othersPost,
                today);
        jdbc.update("UPDATE post SET view_count = 13 WHERE id = ?", popular);
        jdbc.update("UPDATE post SET view_count = 3 WHERE id = ?", secret);
        jdbc.update(
                "INSERT INTO post_like (post_id, member_id) VALUES (?, ?), (?, ?)",
                popular,
                other,
                popular,
                me);
        jdbc.update(
                "INSERT INTO comment (post_id, author_id, content) VALUES (?, ?, '좋아요'), (?, ?, '고마워요')",
                popular,
                other,
                popular,
                me);

        String json = stats(TestLogin.loginAs(mockMvc, me));
        assertThat(number(json, "$.views.today")).isEqualTo(12);
        assertThat(number(json, "$.views.last7Days")).isEqualTo(12);
        assertThat(number(json, "$.views.last30Days")).isEqualTo(16);
        assertThat(number(json, "$.views.total")).isEqualTo(16);
        assertThat((Integer) JsonPath.read(json, "$.daily.length()")).isEqualTo(30);
        assertThat(number(json, "$.daily[29].views")).isEqualTo(12);
        assertThat(number(json, "$.daily[29].likes")).isEqualTo(1);
        assertThat(number(json, "$.daily[29].comments")).isEqualTo(1);
        assertThat(number(json, "$.posts.total")).isEqualTo(2);
        assertThat(number(json, "$.likes.total")).isEqualTo(1);
        assertThat(number(json, "$.likes.today")).isEqualTo(1);
        assertThat(number(json, "$.comments.total")).isEqualTo(1);
        assertThat((Integer) JsonPath.read(json, "$.topPosts.length()")).isEqualTo(2);
        assertThat(number(json, "$.topPosts[0].postId")).isEqualTo(popular);
        assertThat(number(json, "$.topPosts[0].views")).isEqualTo(13);
        assertThat((String) JsonPath.read(json, "$.topPosts[1].visibility")).isEqualTo("PRIVATE");
    }

    @Test
    void 비로그인은_볼_수_없다() throws Exception {
        assertThat(mockMvc.perform(get("/api/me/stats")).andReturn().getResponse().getStatus())
                .isEqualTo(401);
    }
}
