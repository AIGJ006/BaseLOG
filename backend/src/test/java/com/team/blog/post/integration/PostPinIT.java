package com.team.blog.post.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.jayway.jsonpath.JsonPath;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.MemberFixtures;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.PostFixtures;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 고정 글 (028): {@code PUT·DELETE /api/posts/{postId}/pin}, 둥지 고정 글 목록 {@code GET
 * /api/members/{handle}/posts/pinned}, 첫 목록에서 고정 글 빼기, 관리 목록 {@code pinned}, 휴지통으로 옮기면 고정 해제.
 */
class PostPinIT extends IntegrationTestBase {

    private PostFixtures posts;
    private long author;
    private String handle;
    private Cookie session;

    @BeforeEach
    void setUp() {
        MemberFixtures members = new MemberFixtures(jdbc);
        posts = new PostFixtures(jdbc);
        author = members.member().create();
        handle =
                jdbc.queryForObject("SELECT handle FROM member WHERE id = ?", String.class, author);
        session = TestLogin.loginAs(mockMvc, author);
    }

    private long publicPost(int minutesAgo) {
        Instant at = Instant.now().minus(minutesAgo, ChronoUnit.MINUTES);
        return posts.post(author)
                .createdAt(at.minus(1, ChronoUnit.HOURS))
                .updatedAt(at)
                .published("PUBLIC")
                .publishedAt(at)
                .firstPublicAt(at)
                .create();
    }

    private MvcResult pin(Cookie who, long postId) throws Exception {
        return mockMvc.perform(TestLogin.withCsrf(put("/api/posts/{id}/pin", postId), who))
                .andReturn();
    }

    private MvcResult unpin(Cookie who, long postId) throws Exception {
        return mockMvc.perform(TestLogin.withCsrf(delete("/api/posts/{id}/pin", postId), who))
                .andReturn();
    }

    private static String body(MvcResult result) throws Exception {
        return result.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private List<Integer> ids(String path) throws Exception {
        MvcResult result = mockMvc.perform(get(path)).andReturn();
        assertThat(result.getResponse().getStatus()).isEqualTo(200);
        return JsonPath.read(body(result), "$.items[*].id");
    }

    @Test
    void 고정하면_둥지_맨_위_고정_칸에_최근_고정한_순으로_나오고_첫_목록에서는_빠진다() throws Exception {
        long oldest = publicPost(30);
        long middle = publicPost(20);
        long newest = publicPost(10);

        MvcResult first = pin(session, oldest);
        assertThat(first.getResponse().getStatus()).isEqualTo(200);
        assertThat((Boolean) JsonPath.read(body(first), "$.pinned")).isTrue();
        assertThat(pin(session, middle).getResponse().getStatus()).isEqualTo(200);

        assertThat(ids("/api/members/" + handle + "/posts/pinned"))
                .containsExactly((int) middle, (int) oldest);
        assertThat(ids("/api/members/" + handle + "/posts")).containsExactly((int) newest);
        String pinnedBody =
                body(mockMvc.perform(get("/api/members/" + handle + "/posts/pinned")).andReturn());
        List<Boolean> flags = JsonPath.read(pinnedBody, "$.items[*].pinned");
        assertThat(flags).containsOnly(true);

        MvcResult released = unpin(session, oldest);
        assertThat(released.getResponse().getStatus()).isEqualTo(200);
        assertThat((Boolean) JsonPath.read(body(released), "$.pinned")).isFalse();
        assertThat(ids("/api/members/" + handle + "/posts"))
                .containsExactly((int) newest, (int) oldest);
    }

    @Test
    void 같은_요청을_두_번_보내도_같고_4번째는_409_PIN_LIMIT_EXCEEDED() throws Exception {
        long a = publicPost(40);
        long b = publicPost(30);
        long c = publicPost(20);
        long d = publicPost(10);
        pin(session, a);
        String again = body(pin(session, a));
        assertThat((Boolean) JsonPath.read(again, "$.pinned")).isTrue();
        pin(session, b);
        pin(session, c);

        MvcResult over = pin(session, d);
        assertThat(over.getResponse().getStatus()).isEqualTo(409);
        assertThat((String) JsonPath.read(body(over), "$.code")).isEqualTo("PIN_LIMIT_EXCEEDED");
        assertThat(unpin(session, d).getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    void 임시글은_409_남의_글과_없는_글은_404_비회원은_401() throws Exception {
        long draft = posts.post(author).title("임시").create();
        assertThat(pin(session, draft).getResponse().getStatus()).isEqualTo(409);

        long other = new MemberFixtures(jdbc).member().create();
        long othersPost = posts.post(other).published("PUBLIC").create();
        assertThat(pin(session, othersPost).getResponse().getStatus()).isEqualTo(404);
        assertThat(pin(session, posts.nonexistentId()).getResponse().getStatus()).isEqualTo(404);

        MvcResult anonymous =
                mockMvc.perform(TestLogin.withCsrf(put("/api/posts/{id}/pin", othersPost), null))
                        .andReturn();
        assertThat(anonymous.getResponse().getStatus()).isEqualTo(401);
    }

    @Test
    void 비공개_고정_글은_고정_칸에_보이지_않고_휴지통으로_옮기면_고정이_풀린다() throws Exception {
        long secret = posts.post(author).published("PRIVATE").create();
        long open = publicPost(10);
        pin(session, secret);
        pin(session, open);
        assertThat(ids("/api/members/" + handle + "/posts/pinned")).containsExactly((int) open);

        mockMvc.perform(TestLogin.withCsrf(delete("/api/posts/{id}", open), session)).andReturn();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT pinned_at IS NULL FROM post WHERE id = ?",
                                Boolean.class,
                                open))
                .isTrue();
        assertThat(ids("/api/members/" + handle + "/posts/pinned")).isEmpty();
    }

    @Test
    void 관리_목록에_pinned가_나온다() throws Exception {
        long pinned = publicPost(20);
        long plain = publicPost(10);
        pin(session, pinned);

        MvcResult result =
                mockMvc.perform(get("/api/me/posts?tab=published").cookie(session)).andReturn();
        String json = body(result);
        List<Boolean> pinnedFlag = JsonPath.read(json, "$.items[?(@.id == " + pinned + ")].pinned");
        List<Boolean> plainFlag = JsonPath.read(json, "$.items[?(@.id == " + plain + ")].pinned");
        assertThat(pinnedFlag).containsExactly(true);
        assertThat(plainFlag).containsExactly(false);
    }
}
