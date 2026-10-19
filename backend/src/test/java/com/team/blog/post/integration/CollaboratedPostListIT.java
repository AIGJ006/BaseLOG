package com.team.blog.post.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.team.blog.notification.support.NotificationTestBase;
import com.team.blog.post.support.EditorApi;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.FriendFixtures;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * 030 공동 작업 글 목록 (2026-10-19 민서): 카드의 {@code collaborative} 표시, 공동 작업자 둥지 첫 목록·공동 작업자 친구의 피드에 함께
 * 나오기. 원래 공개 범위보다 넓게 보이지 않는다 — 친구 공개 글은 글쓴이의 친구에게만.
 */
class CollaboratedPostListIT extends NotificationTestBase {

    private EditorApi editor;
    private FriendFixtures friends;
    private long author;
    private long collaborator;
    private long collaboratorFriend;
    private long authorFriend;
    private Cookie authorSession;
    private Cookie collaboratorFriendSession;
    private Cookie authorFriendSession;
    private String authorHandle;
    private String collaboratorHandle;
    private long publicPost;
    private long friendsPost;

    @BeforeEach
    void setUp() throws Exception {
        editor = new EditorApi(mockMvc);
        friends = new FriendFixtures(jdbc);
        author = members().member().create();
        collaborator = members().member().create();
        collaboratorFriend = members().member().create();
        authorFriend = members().member().create();
        friends.friends(author, collaborator);
        friends.friends(collaborator, collaboratorFriend);
        friends.friends(author, authorFriend);
        authorSession = TestLogin.loginAs(mockMvc, author);
        collaboratorFriendSession = TestLogin.loginAs(mockMvc, collaboratorFriend);
        authorFriendSession = TestLogin.loginAs(mockMvc, authorFriend);
        authorHandle = handleOf(author);
        collaboratorHandle = handleOf(collaborator);
        publicPost = publish("함께 쓴 전체 공개 글", "PUBLIC");
        friendsPost = publish("함께 쓴 친구 공개 글", "FRIENDS");
        for (long post : List.of(publicPost, friendsPost)) {
            MvcResult set =
                    perform(
                            put("/api/posts/{id}/collaborators", post)
                                    .contentType(MediaType.APPLICATION_JSON)
                                    .content(
                                            EditorApi.json(
                                                    Map.of(
                                                            "handles",
                                                            List.of(collaboratorHandle)))),
                            authorSession);
            assertThat(EditorApi.status(set)).isEqualTo(200);
        }
    }

    private long publish(String title, String visibility) throws Exception {
        long id = editor.createPostId(authorSession);
        MvcResult published =
                editor.publish(
                        authorSession,
                        id,
                        EditorApi.publishBody(title, "본문입니다", List.of(), visibility, 0),
                        UUID.randomUUID().toString());
        assertThat(EditorApi.status(published)).isEqualTo(200);
        return id;
    }

    private String handleOf(long memberId) {
        return jdbc.queryForObject(
                "SELECT handle FROM member WHERE id = ?", String.class, memberId);
    }

    private MvcResult perform(MockHttpServletRequestBuilder request, Cookie session)
            throws Exception {
        return session == null
                ? mockMvc.perform(request).andReturn()
                : mockMvc.perform(TestLogin.withCsrf(request, session)).andReturn();
    }

    private List<Number> ids(MvcResult result) {
        assertThat(EditorApi.status(result)).isEqualTo(200);
        return EditorApi.read(result, "$.items[*].id");
    }

    private List<Number> blog(String handle, Cookie session) throws Exception {
        return ids(perform(get("/api/members/{handle}/posts", handle), session));
    }

    private static List<Long> longs(List<Number> ids) {
        return ids.stream().map(Number::longValue).toList();
    }

    @Test
    void 공동_작업자_둥지에_전체_공개_글이_공동_작업_표시와_함께_나온다() throws Exception {
        MvcResult anonymous = perform(get("/api/members/{handle}/posts", collaboratorHandle), null);
        assertThat(longs(ids(anonymous))).containsExactly(publicPost);
        assertThat((List<Boolean>) EditorApi.read(anonymous, "$.items[*].collaborative"))
                .containsExactly(true);

        // 글쓴이 둥지에서도 공동 작업 표시
        MvcResult own = perform(get("/api/members/{handle}/posts", authorHandle), null);
        assertThat((List<Boolean>) EditorApi.read(own, "$.items[*].collaborative"))
                .containsExactly(true);
    }

    @Test
    void 친구_공개_글은_글쓴이의_친구에게만_공동_작업자_둥지에_나온다() throws Exception {
        // 공동 작업자의 친구지만 글쓴이의 친구는 아님 → 전체 공개 글만
        assertThat(longs(blog(collaboratorHandle, collaboratorFriendSession)))
                .containsExactly(publicPost);
        // 글쓴이 자신(공동 작업자의 친구) → 둘 다
        assertThat(longs(blog(collaboratorHandle, authorSession)))
                .containsExactlyInAnyOrder(publicPost, friendsPost);
        // 글쓴이의 친구지만 공동 작업자의 친구는 아님 → 남이 보는 둥지라 전체 공개 글만
        assertThat(longs(blog(collaboratorHandle, authorFriendSession)))
                .containsExactly(publicPost);
    }

    @Test
    void 공동_작업자의_친구_피드에_전체_공개_글이_나온다() throws Exception {
        MvcResult feed = perform(get("/api/feed"), collaboratorFriendSession);
        assertThat(longs(ids(feed))).containsExactly(publicPost);
        assertThat((List<Boolean>) EditorApi.read(feed, "$.items[*].collaborative"))
                .containsExactly(true);

        // 글쓴이의 친구 피드는 그대로 (친구 공개 글 포함)
        assertThat(longs(ids(perform(get("/api/feed"), authorFriendSession))))
                .containsExactlyInAnyOrder(publicPost, friendsPost);
        // 글쓴이 자신의 피드에는 자기 글이 나오지 않는다
        assertThat(ids(perform(get("/api/feed"), authorSession))).isEmpty();
    }

    @Test
    void 친구가_끊기면_공동_작업자_둥지와_피드에서_빠지고_표시도_없어진다() throws Exception {
        jdbc.update(
                "DELETE FROM friendship WHERE member_a_id = ? AND member_b_id = ?",
                Math.min(author, collaborator),
                Math.max(author, collaborator));

        assertThat(blog(collaboratorHandle, null)).isEmpty();
        assertThat(ids(perform(get("/api/feed"), collaboratorFriendSession))).isEmpty();
        MvcResult own = perform(get("/api/members/{handle}/posts", authorHandle), null);
        assertThat((List<Boolean>) EditorApi.read(own, "$.items[*].collaborative"))
                .containsExactly(false);
    }
}
