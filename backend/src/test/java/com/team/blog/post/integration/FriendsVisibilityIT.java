package com.team.blog.post.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.team.blog.account.domain.MemberStatus;
import com.team.blog.account.domain.Role;
import com.team.blog.post.domain.Visibility;
import com.team.blog.post.domain.VisibilityRegistry;
import com.team.blog.post.infra.SqlCondition;
import com.team.blog.post.infra.VisibilityFilter;
import com.team.blog.post.support.VisibilityApi;
import com.team.blog.shared.security.Viewer;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.MemberFixtures;
import com.team.blog.support.ReferenceListQueries;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.PostFixtures;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 친구 공개 (004 T068, US8-2·US8-3, FR-048, research R-14). 2026-10-13에 켰다({@code
 * V7__friends_visibility.sql}).
 *
 * <p>친구 관계는 001 {@code friendship} 표에 직접 넣는다(001 친구 API와 무관).
 */
class FriendsVisibilityIT extends IntegrationTestBase {

    @Autowired private VisibilityFilter visibilityFilter;
    @Autowired private VisibilityRegistry registry;
    @Autowired private TransactionTemplate transactionTemplate;

    private PostFixtures posts;
    private MemberFixtures members;
    private long author;
    private long friend;
    private long pending;
    private long stranger;

    @BeforeEach
    void setUp() {
        members = new MemberFixtures(jdbc);
        posts = new PostFixtures(jdbc);
        author = members.member().create();
        friend = members.member().create();
        pending = members.member().create();
        stranger = members.member().create();
        befriend(author, friend, "ACCEPTED");
        befriend(pending, author, "PENDING");
    }

    private void befriend(long requester, long other, String status) {
        jdbc.update(
                "INSERT INTO friendship (member_a_id, member_b_id, requested_by, status, accepted_at)"
                        + " VALUES (?, ?, ?, ?, ?)",
                Math.min(requester, other),
                Math.max(requester, other),
                requester,
                status,
                "ACCEPTED".equals(status) ? Timestamp.from(Instant.now()) : null);
    }

    private long friendsPost() {
        return posts.post(author).published("FRIENDS").create();
    }

    private static Viewer viewer(long id) {
        return new Viewer(id, Role.USER, MemberStatus.ACTIVE, true);
    }

    private int read(long postId, Long memberId) throws Exception {
        var request = get("/api/__test/posts/{postId}", postId);
        if (memberId != null) {
            request.cookie(TestLogin.loginAs(mockMvc, memberId));
        }
        return mockMvc.perform(request).andReturn().getResponse().getStatus();
    }

    private List<Long> friendBlog(Viewer viewer) {
        SqlCondition c = visibilityFilter.forFriendBlog(viewer, author);
        return new NamedParameterJdbcTemplate(jdbc)
                .queryForList(
                        "SELECT p.id FROM post p JOIN member m ON m.id = p.author_id WHERE "
                                + c.sql()
                                + " ORDER BY p.published_at DESC, p.id DESC LIMIT 10",
                        c.params(),
                        Long.class);
    }

    private long friendBlogCount(Viewer viewer) {
        SqlCondition c = visibilityFilter.forFriendBlog(viewer, author);
        return new NamedParameterJdbcTemplate(jdbc)
                .queryForObject(
                        "SELECT COUNT(*) FROM post p JOIN member m ON m.id = p.author_id WHERE "
                                + c.sql(),
                        c.params(),
                        Long.class);
    }

    @Test
    void 적용_환경은_FRIENDS를_허용한다() throws Exception {
        assertThat(registry.allowedValues()).contains(Visibility.FRIENDS);
        long postId = posts.post(author).published("PUBLIC").create();

        MvcResult result =
                new VisibilityApi(mockMvc)
                        .change(TestLogin.loginAs(mockMvc, author), postId, "FRIENDS");

        assertThat(VisibilityApi.status(result)).isEqualTo(200);
        assertThat((String) VisibilityApi.read(result, "$.visibility")).isEqualTo("FRIENDS");
        jdbc.update("UPDATE member SET default_visibility = 'FRIENDS' WHERE id = ?", author);
    }

    @Test
    void US8_2_수락된_친구와_작성자만_상세를_보고_나머지는_404() throws Exception {
        long postId = friendsPost();

        assertThat(read(postId, friend)).isEqualTo(200);
        assertThat(read(postId, author)).isEqualTo(200);
        assertThat(read(postId, null)).as("비회원").isEqualTo(404);
        assertThat(read(postId, stranger)).as("친구 아님").isEqualTo(404);
        assertThat(read(postId, pending)).as("요청 중").isEqualTo(404);
        assertThat(read(postId, members.member().role("ADMIN").create())).as("관리자").isEqualTo(404);
    }

    @Test
    void US8_2_친구가_보는_블로그_목록과_글_수에만_있고_홈_공용_조건에는_없다() {
        long publicPost = posts.post(author).published("PUBLIC").create();
        long postId = friendsPost();
        ReferenceListQueries lists = new ReferenceListQueries(jdbc, visibilityFilter);

        assertThat(friendBlog(viewer(friend))).containsExactlyInAnyOrder(postId, publicPost);
        assertThat(friendBlogCount(viewer(friend))).isEqualTo(2);
        for (Viewer other : List.of(Viewer.anonymous(), viewer(stranger), viewer(pending))) {
            assertThat(friendBlog(other)).containsExactly(publicPost);
            assertThat(friendBlogCount(other)).isEqualTo(1);
        }
        for (Viewer anyone : List.of(Viewer.anonymous(), viewer(friend), viewer(author))) {
            assertThat(lists.home(anyone)).doesNotContain(postId);
            assertThat(lists.listedEverywhere(anyone)).doesNotContain(postId);
            assertThat(lists.blog(anyone, author)).doesNotContain(postId);
            assertThat(lists.blogCount(anyone, author)).isEqualTo(1);
        }
    }

    @Test
    void US8_3_친구를_끊은_순간_404이고_목록에서_빠진다() throws Exception {
        long postId = friendsPost();
        assertThat(read(postId, friend)).isEqualTo(200);

        jdbc.update(
                "DELETE FROM friendship WHERE member_a_id = ? AND member_b_id = ?",
                Math.min(author, friend),
                Math.max(author, friend));

        assertThat(read(postId, friend)).isEqualTo(404);
        assertThat(friendBlog(viewer(friend))).doesNotContain(postId);
    }

    @Test
    void FRIENDS에서_PUBLIC으로_바꾸면_그_순간이_최초_공개_일자이고_홈_맨_위() throws Exception {
        long older = posts.post(author).published("PUBLIC").create();
        long postId = friendsPost();
        Instant before = Instant.now().truncatedTo(ChronoUnit.MICROS);

        MvcResult result =
                new VisibilityApi(mockMvc)
                        .change(TestLogin.loginAs(mockMvc, author), postId, "PUBLIC");

        assertThat(VisibilityApi.status(result)).isEqualTo(200);
        Instant firstPublicAt = Instant.parse(VisibilityApi.read(result, "$.firstPublicAt"));
        assertThat(firstPublicAt).isAfterOrEqualTo(before);
        assertThat(new ReferenceListQueries(jdbc, visibilityFilter).home(Viewer.anonymous()))
                .containsSubsequence(postId, older)
                .first()
                .isEqualTo(postId);
    }

    @Test
    void 친구_블로그_목록은_발행_일자_최신순_같으면_번호_큰_순() {
        long first = friendsPost();
        long second = posts.post(author).published("PUBLIC").create();
        long third = friendsPost();
        Timestamp same = Timestamp.from(Instant.parse("2026-10-01T00:00:00Z"));
        jdbc.update("UPDATE post SET published_at = ? WHERE id IN (?, ?)", same, first, third);
        jdbc.update(
                "UPDATE post SET published_at = ?, first_public_at = ? WHERE id = ?",
                Timestamp.from(Instant.parse("2026-10-02T00:00:00Z")),
                Timestamp.from(Instant.parse("2026-10-02T00:00:00Z")),
                second);

        assertThat(friendBlog(viewer(friend))).containsExactly(second, third, first);
    }

    @Test
    void 블로그_API는_친구에게만_친구_공개_글을_발행_일자순으로_넘기고_글_수_태그_줄도_같다() throws Exception {
        String handle =
                jdbc.queryForObject("SELECT handle FROM member WHERE id = ?", String.class, author);
        Instant base = Instant.parse("2026-10-01T00:00:00Z");
        List<Long> newestFirst = new java.util.ArrayList<>();
        List<Long> publicNewestFirst = new java.util.ArrayList<>();
        for (int i = 0; i < 12; i++) {
            boolean friendsOnly = i % 2 == 0;
            long id = posts.post(author).published(friendsOnly ? "FRIENDS" : "PUBLIC").create();
            Timestamp at = Timestamp.from(base.plusSeconds(i));
            jdbc.update(
                    "UPDATE post SET published_at = ?, first_public_at = ? WHERE id = ?",
                    at,
                    friendsOnly ? null : at,
                    id);
            new com.team.blog.tag.support.TagFixtures(jdbc).attach(id, "friends-tag");
            newestFirst.add(0, id);
            if (!friendsOnly) {
                publicNewestFirst.add(0, id);
            }
        }

        assertThat(blogPostIds(handle, friend)).containsExactlyElementsOf(newestFirst);
        assertThat(headerCount(handle, friend)).isEqualTo(12);
        assertThat(blogTagCount(handle, friend)).isEqualTo(12);
        for (Long other : java.util.Arrays.asList(null, stranger, pending, author)) {
            assertThat(blogPostIds(handle, other))
                    .as("보는 사람 %s", other)
                    .containsExactlyElementsOf(publicNewestFirst);
            assertThat(headerCount(handle, other)).isEqualTo(6);
            assertThat(blogTagCount(handle, other)).isEqualTo(6);
        }
    }

    private MvcResult getAs(String path, Long memberId, String... query) throws Exception {
        var request = get(path);
        for (int i = 0; i + 1 < query.length; i += 2) {
            request.param(query[i], query[i + 1]);
        }
        if (memberId != null) {
            request.cookie(TestLogin.loginAs(mockMvc, memberId));
        }
        return mockMvc.perform(request).andReturn();
    }

    /** 블로그 글 목록을 커서로 끝까지 읽은 글 번호 */
    private List<Long> blogPostIds(String handle, Long memberId) throws Exception {
        List<Long> ids = new java.util.ArrayList<>();
        String cursor = null;
        do {
            MvcResult page =
                    cursor == null
                            ? getAs("/api/members/" + handle + "/posts", memberId)
                            : getAs(
                                    "/api/members/" + handle + "/posts",
                                    memberId,
                                    "cursor",
                                    cursor);
            assertThat(page.getResponse().getStatus()).isEqualTo(200);
            String body = page.getResponse().getContentAsString();
            List<Number> pageIds = com.jayway.jsonpath.JsonPath.read(body, "$.items[*].id");
            pageIds.forEach(n -> ids.add(n.longValue()));
            cursor = com.jayway.jsonpath.JsonPath.read(body, "$.nextCursor");
        } while (cursor != null);
        return ids;
    }

    private long headerCount(String handle, Long memberId) throws Exception {
        String body = getAs("/api/members/" + handle, memberId).getResponse().getContentAsString();
        return ((Number) com.jayway.jsonpath.JsonPath.read(body, "$.publicPostCount")).longValue();
    }

    private long blogTagCount(String handle, Long memberId) throws Exception {
        String body =
                getAs("/api/members/" + handle + "/tags", memberId)
                        .getResponse()
                        .getContentAsString();
        List<Number> counts =
                com.jayway.jsonpath.JsonPath.read(
                        body, "$.items[?(@.name == 'friends-tag')].postCount");
        return counts.isEmpty() ? 0 : counts.get(0).longValue();
    }

    @Test
    void 친구_블로그_목록은_ix_post_blog_friends를_탄다() {
        friendsPost();
        SqlCondition c = visibilityFilter.forFriendBlog(viewer(friend), author);

        String plan =
                transactionTemplate.execute(
                        tx -> {
                            jdbc.execute("SET LOCAL enable_seqscan = off");
                            return new NamedParameterJdbcTemplate(jdbc)
                                    .queryForObject(
                                            "EXPLAIN (FORMAT JSON) SELECT p.id FROM post p JOIN member m"
                                                    + " ON m.id = p.author_id WHERE "
                                                    + c.sql()
                                                    + " ORDER BY p.published_at DESC, p.id DESC LIMIT 10",
                                            c.params(),
                                            String.class);
                        });

        assertThat(plan).contains("\"ix_post_blog_friends\"");
    }
}
