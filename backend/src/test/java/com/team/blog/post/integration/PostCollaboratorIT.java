package com.team.blog.post.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
 * 공동 작업자 (030): {@code GET·PUT /api/posts/{postId}/collaborators}, 공동 작업자의 에디터 열기·저장·다시 등록(제목·본문만),
 * 삭제·공개 범위·카테고리·공동 작업자 바꾸기는 글쓴이만, 친구를 끊으면 빠짐, 글 상세의 함께 쓴 사람, 추가 알림.
 */
class PostCollaboratorIT extends NotificationTestBase {

    private EditorApi editor;
    private FriendFixtures friends;
    private long author;
    private long friend;
    private long stranger;
    private Cookie authorSession;
    private Cookie friendSession;
    private Cookie strangerSession;
    private String friendHandle;
    private String strangerHandle;
    private long postId;

    @BeforeEach
    void setUp() throws Exception {
        editor = new EditorApi(mockMvc);
        friends = new FriendFixtures(jdbc);
        author = members().member().create();
        friend = members().member().create();
        stranger = members().member().create();
        friends.friends(author, friend);
        authorSession = TestLogin.loginAs(mockMvc, author);
        friendSession = TestLogin.loginAs(mockMvc, friend);
        strangerSession = TestLogin.loginAs(mockMvc, stranger);
        friendHandle = handleOf(friend);
        strangerHandle = handleOf(stranger);
        postId = editor.createPostId(authorSession);
        MvcResult published =
                editor.publish(
                        authorSession,
                        postId,
                        EditorApi.publishBody("함께 쓰는 글", "처음 본문", List.of("여행"), "FRIENDS", 0),
                        UUID.randomUUID().toString());
        assertThat(EditorApi.status(published)).isEqualTo(200);
    }

    private String handleOf(long memberId) {
        return jdbc.queryForObject(
                "SELECT handle FROM member WHERE id = ?", String.class, memberId);
    }

    private MvcResult perform(MockHttpServletRequestBuilder request, Cookie session)
            throws Exception {
        return mockMvc.perform(TestLogin.withCsrf(request, session)).andReturn();
    }

    private MvcResult setCollaborators(Cookie session, long post, List<String> handles)
            throws Exception {
        return perform(
                put("/api/posts/{id}/collaborators", post)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(EditorApi.json(Map.of("handles", handles))),
                session);
    }

    private long version(Cookie session) throws Exception {
        MvcResult opened = editor.workingCopy(session, postId);
        assertThat(EditorApi.status(opened)).isEqualTo(200);
        return ((Number) EditorApi.read(opened, "$.version")).longValue();
    }

    @Test
    void 글쓴이가_친구를_고르면_목록과_글_상세에_보이고_알림이_간다() throws Exception {
        MvcResult set = setCollaborators(authorSession, postId, List.of(friendHandle));
        assertThat(EditorApi.status(set)).isEqualTo(200);
        assertThat((List<String>) EditorApi.read(set, "$.items[*].handle"))
                .containsExactly(friendHandle);

        MvcResult listed = perform(get("/api/posts/{id}/collaborators", postId), authorSession);
        assertThat((List<String>) EditorApi.read(listed, "$.items[*].handle"))
                .containsExactly(friendHandle);

        MvcResult detail = perform(get("/api/posts/{id}", postId), friendSession);
        assertThat(EditorApi.status(detail)).isEqualTo(200);
        assertThat((List<String>) EditorApi.read(detail, "$.collaborators[*].handle"))
                .containsExactly(friendHandle);
        assertThat((Boolean) EditorApi.read(detail, "$.viewer.isCollaborator")).isTrue();
        assertThat((Boolean) EditorApi.read(detail, "$.viewer.isAuthor")).isFalse();

        MvcResult byAuthor = perform(get("/api/posts/{id}", postId), authorSession);
        assertThat((Boolean) EditorApi.read(byAuthor, "$.viewer.isCollaborator")).isFalse();

        awaiter.untilCount(friend, 1);
        Map<String, Object> row = notifications.rows(friend).get(0);
        assertThat(row.get("type")).isEqualTo("COLLABORATOR_ADDED");
        assertThat(((Number) row.get("post_id")).longValue()).isEqualTo(postId);
        assertThat(((Number) row.get("last_actor_id")).longValue()).isEqualTo(author);

        // 같은 사람을 다시 골라도 알림은 한 번
        setCollaborators(authorSession, postId, List.of(friendHandle));
        awaiter.idle();
        assertThat(notifications.count(friend)).isEqualTo(1);
    }

    @Test
    void 친구가_아니거나_나_자신이면_400_네_명이면_400_남의_글은_404() throws Exception {
        MvcResult notFriend = setCollaborators(authorSession, postId, List.of(strangerHandle));
        assertThat(EditorApi.status(notFriend)).isEqualTo(400);
        assertThat((String) EditorApi.read(notFriend, "$.errors[0].code"))
                .isEqualTo("COLLABORATOR_NOT_FRIEND");
        assertThat((String) EditorApi.read(notFriend, "$.errors[0].field")).isEqualTo("handles");

        MvcResult self = setCollaborators(authorSession, postId, List.of(handleOf(author)));
        assertThat((String) EditorApi.read(self, "$.errors[0].code"))
                .isEqualTo("COLLABORATOR_NOT_FRIEND");

        long f2 = members().member().create();
        long f3 = members().member().create();
        long f4 = members().member().create();
        friends.friends(author, f2);
        friends.friends(author, f3);
        friends.friends(author, f4);
        MvcResult four =
                setCollaborators(
                        authorSession,
                        postId,
                        List.of(friendHandle, handleOf(f2), handleOf(f3), handleOf(f4)));
        assertThat(EditorApi.status(four)).isEqualTo(400);
        assertThat((String) EditorApi.read(four, "$.errors[0].code"))
                .isEqualTo("TOO_MANY_COLLABORATORS");
        MvcResult three =
                setCollaborators(
                        authorSession, postId, List.of(friendHandle, handleOf(f2), handleOf(f3)));
        assertThat(EditorApi.status(three)).isEqualTo(200);

        assertThat(EditorApi.status(setCollaborators(friendSession, postId, List.of())))
                .isEqualTo(404);
        assertThat(
                        EditorApi.status(
                                perform(
                                        get("/api/posts/{id}/collaborators", postId),
                                        friendSession)))
                .isEqualTo(404);
    }

    @Test
    void 공동_작업자는_제목과_본문만_고쳐_다시_등록하고_공개_범위와_태그는_그대로() throws Exception {
        setCollaborators(authorSession, postId, List.of(friendHandle));

        MvcResult opened = editor.workingCopy(friendSession, postId);
        assertThat(EditorApi.status(opened)).isEqualTo(200);
        assertThat((Boolean) EditorApi.read(opened, "$.collaborator")).isTrue();
        assertThat((String) EditorApi.read(opened, "$.title")).isEqualTo("함께 쓰는 글");
        assertThat(
                        (Boolean)
                                EditorApi.read(
                                        editor.workingCopy(authorSession, postId),
                                        "$.collaborator"))
                .isFalse();

        long base = version(friendSession);
        MvcResult autosaved =
                editor.autosave(friendSession, postId, EditorApi.saveBody("고친 제목", "친구가 고침", base));
        assertThat(EditorApi.status(autosaved)).isEqualTo(200);
        long saved = ((Number) EditorApi.read(autosaved, "$.version")).longValue();
        MvcResult manual =
                editor.save(friendSession, postId, EditorApi.saveBody("고친 제목", "친구가 고침 2", saved));
        assertThat(EditorApi.status(manual)).isEqualTo(200);
        long now = ((Number) EditorApi.read(manual, "$.version")).longValue();

        // 글쓴이도 같은 내용을 이어서 본다 (보관분 주인이 글쓴이라 막히지 않는다)
        assertThat(
                        (String)
                                EditorApi.read(
                                        editor.workingCopy(authorSession, postId), "$.contentMd"))
                .isEqualTo("친구가 고침 2");

        MvcResult republished =
                editor.publish(
                        friendSession,
                        postId,
                        EditorApi.publishBody("고친 제목", "친구가 고침 2", List.of("다른태그"), "PUBLIC", now),
                        UUID.randomUUID().toString());
        assertThat(EditorApi.status(republished)).isEqualTo(200);

        Map<String, Object> post =
                jdbc.queryForMap(
                        "SELECT title, content_md, visibility, author_id FROM post WHERE id = ?",
                        postId);
        assertThat(post.get("title")).isEqualTo("고친 제목");
        assertThat(post.get("content_md")).isEqualTo("친구가 고침 2");
        assertThat(post.get("visibility")).isEqualTo("FRIENDS");
        assertThat(((Number) post.get("author_id")).longValue()).isEqualTo(author);
        assertThat(
                        jdbc.queryForList(
                                "SELECT t.name FROM post_tag pt JOIN tag t ON t.id = pt.tag_id"
                                        + " WHERE pt.post_id = ?",
                                String.class,
                                postId))
                .containsExactly("여행");
    }

    @Test
    void 공동_작업자도_삭제_공개_범위_카테고리는_404() throws Exception {
        setCollaborators(authorSession, postId, List.of(friendHandle));

        assertThat(EditorApi.status(perform(delete("/api/posts/{id}", postId), friendSession)))
                .isEqualTo(404);
        assertThat(
                        EditorApi.status(
                                perform(
                                        put("/api/posts/{id}/visibility", postId)
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content("{\"visibility\":\"PUBLIC\"}"),
                                        friendSession)))
                .isEqualTo(404);
        assertThat(
                        EditorApi.status(
                                perform(
                                        put("/api/posts/{id}/category", postId)
                                                .contentType(MediaType.APPLICATION_JSON)
                                                .content("{\"categoryId\":null}"),
                                        friendSession)))
                .isEqualTo(404);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT deleted_at IS NULL FROM post WHERE id = ?",
                                Boolean.class,
                                postId))
                .isTrue();
    }

    @Test
    void 공동_작업자가_아니면_에디터_저장_등록_모두_404() throws Exception {
        assertThat(EditorApi.status(editor.workingCopy(friendSession, postId))).isEqualTo(404);
        assertThat(EditorApi.status(editor.workingCopy(strangerSession, postId))).isEqualTo(404);
        assertThat(
                        EditorApi.status(
                                editor.save(
                                        strangerSession,
                                        postId,
                                        EditorApi.saveBody("남", "남이 고침", 1))))
                .isEqualTo(404);
        assertThat(
                        EditorApi.status(
                                editor.autosave(
                                        friendSession, postId, EditorApi.saveBody("남", "남", 1))))
                .isEqualTo(404);
        assertThat(
                        EditorApi.status(
                                editor.publish(
                                        friendSession,
                                        postId,
                                        EditorApi.publishBody("남", "남", List.of(), "PUBLIC", 1),
                                        UUID.randomUUID().toString())))
                .isEqualTo(404);
        assertThat(EditorApi.status(editor.discard(friendSession, postId))).isEqualTo(404);
    }

    @Test
    void 임시글은_공동_작업자로_골라도_열_수_없다() throws Exception {
        long draft = editor.createPostId(authorSession);
        assertThat(EditorApi.status(setCollaborators(authorSession, draft, List.of(friendHandle))))
                .isEqualTo(200);
        assertThat(EditorApi.status(editor.workingCopy(friendSession, draft))).isEqualTo(404);
    }

    @Test
    void 친구를_끊으면_공동_작업자에서_빠진다() throws Exception {
        setCollaborators(authorSession, postId, List.of(friendHandle));
        assertThat(EditorApi.status(editor.workingCopy(friendSession, postId))).isEqualTo(200);

        MvcResult ended =
                perform(delete("/api/members/{handle}/friend", handleOf(author)), friendSession);
        assertThat(EditorApi.status(ended)).isEqualTo(200);

        assertThat(EditorApi.status(editor.workingCopy(friendSession, postId))).isEqualTo(404);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM post_collaborator WHERE post_id = ?",
                                Long.class,
                                postId))
                .isZero();
        MvcResult listed = perform(get("/api/posts/{id}/collaborators", postId), authorSession);
        assertThat((List<String>) EditorApi.read(listed, "$.items")).isEmpty();
    }

    @Test
    void 공동_작업자가_있는_글은_나만_보기로_등록하거나_바꿀_수_없다() throws Exception {
        setCollaborators(authorSession, postId, List.of(friendHandle));

        MvcResult change =
                perform(
                        put("/api/posts/{id}/visibility", postId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"visibility\":\"PRIVATE\"}"),
                        authorSession);
        assertThat(EditorApi.status(change)).isEqualTo(400);
        assertThat((String) EditorApi.read(change, "$.errors[0].code"))
                .isEqualTo("COLLABORATOR_POST_PRIVATE");

        long base = version(authorSession);
        MvcResult republish =
                editor.publish(
                        authorSession,
                        postId,
                        EditorApi.publishBody("함께 쓰는 글", "처음 본문", List.of("여행"), "PRIVATE", base),
                        UUID.randomUUID().toString());
        assertThat(EditorApi.status(republish)).isEqualTo(400);
        assertThat((String) EditorApi.read(republish, "$.errors[0].code"))
                .isEqualTo("COLLABORATOR_POST_PRIVATE");
        assertThat(
                        jdbc.queryForObject(
                                "SELECT visibility FROM post WHERE id = ?", String.class, postId))
                .isEqualTo("FRIENDS");

        // 공동 작업자를 모두 빼면 나만 보기로 바꿀 수 있다
        setCollaborators(authorSession, postId, List.of());
        MvcResult afterClear =
                perform(
                        put("/api/posts/{id}/visibility", postId)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"visibility\":\"PRIVATE\"}"),
                        authorSession);
        assertThat(EditorApi.status(afterClear)).isEqualTo(200);
    }

    @Test
    void 나만_보기_글에는_공동_작업자를_고를_수_없다() throws Exception {
        perform(
                put("/api/posts/{id}/visibility", postId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"visibility\":\"PRIVATE\"}"),
                authorSession);
        MvcResult set = setCollaborators(authorSession, postId, List.of(friendHandle));
        assertThat(EditorApi.status(set)).isEqualTo(400);
        assertThat((String) EditorApi.read(set, "$.errors[0].code"))
                .isEqualTo("PRIVATE_POST_COLLABORATORS");
        assertThat(EditorApi.status(setCollaborators(authorSession, postId, List.of())))
                .isEqualTo(200);
    }
}
