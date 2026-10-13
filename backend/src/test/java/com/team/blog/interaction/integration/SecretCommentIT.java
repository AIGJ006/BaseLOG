package com.team.blog.interaction.integration;

import static com.team.blog.interaction.support.CommentApi.body;
import static com.team.blog.interaction.support.CommentApi.id;
import static com.team.blog.interaction.support.CommentApi.read;
import static com.team.blog.interaction.support.CommentApi.status;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import com.team.blog.interaction.support.CommentApi;
import com.team.blog.interaction.support.CommentFixtures;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.PostFixtures;
import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.Arrays;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;

/** 비밀 댓글·비밀 답글 (007 비밀 댓글, 2026-10-13): 누가 내용을 보고, 누가 답글·신고할 수 있는가. */
class SecretCommentIT extends IntegrationTestBase {

    private static final Instant BASE = Instant.parse("2026-10-01T00:00:00Z");

    private long postAuthor;
    private long writer;
    private long outsider;
    private long postId;

    private CommentApi api() {
        return new CommentApi(mockMvc);
    }

    private CommentFixtures comments() {
        return new CommentFixtures(jdbc);
    }

    private Cookie login(long memberId) throws Exception {
        return TestLogin.loginAs(mockMvc, memberId);
    }

    @BeforeEach
    void setUp() {
        postAuthor = members().member().create();
        writer = members().member().nickname("비밀쓴이").create();
        outsider = members().member().create();
        postId = new PostFixtures(jdbc).create(postAuthor, PostFixtures.State.PUBLISHED_PUBLIC);
    }

    @Test
    void 비밀_댓글을_쓰면_작성자에게_내용과_비밀_표시가_돌아온다() throws Exception {
        MvcResult created = api().create(login(writer), postId, "비밀원문ABC", null, true);

        assertThat(status(created)).isEqualTo(201);
        assertThat((Boolean) read(created, "$.secret")).isTrue();
        assertThat((Boolean) read(created, "$.secretLocked")).isFalse();
        assertThat((String) read(created, "$.content")).isEqualTo("비밀원문ABC");
    }

    @Test
    void secret을_빼면_공개_댓글() throws Exception {
        MvcResult created = api().create(login(writer), postId, "공개 댓글");

        assertThat((Boolean) read(created, "$.secret")).isFalse();
        MvcResult page = api().list(null, postId);
        assertThat((String) read(page, "$.items[0].content")).isEqualTo("공개 댓글");
    }

    @Test
    void 비밀_댓글은_작성자와_글_주인만_읽고_남은_작성자만_본다() throws Exception {
        comments().on(postId, writer).content("비밀원문ABC").secret().at(BASE).create();

        for (Cookie reader : Arrays.asList(login(writer), login(postAuthor))) {
            MvcResult page = api().list(reader, postId);
            assertThat((String) read(page, "$.items[0].content")).isEqualTo("비밀원문ABC");
            assertThat((Boolean) read(page, "$.items[0].secret")).isTrue();
            assertThat((Boolean) read(page, "$.items[0].secretLocked")).isFalse();
        }
        Cookie admin = login(members().member().role("ADMIN").create());
        for (Cookie reader : Arrays.asList(null, login(outsider), admin)) {
            MvcResult page = api().list(reader, postId);
            assertThat(body(page)).doesNotContain("비밀원문ABC");
            assertThat((String) read(page, "$.items[0].state")).isEqualTo("NORMAL");
            assertThat((Object) read(page, "$.items[0].content")).isNull();
            assertThat((Boolean) read(page, "$.items[0].secretLocked")).isTrue();
            assertThat((String) read(page, "$.items[0].author.nickname")).isEqualTo("비밀쓴이");
        }
    }

    @Test
    void 비밀_답글은_답글_작성자_최상위_작성자_글_주인만() throws Exception {
        long rootAuthor = members().member().create();
        long root = comments().on(postId, rootAuthor).content("공개 최상위").at(BASE).create();
        comments()
                .on(postId, writer)
                .parent(root)
                .content("비밀답글XYZ")
                .secret()
                .at(BASE.plusSeconds(1))
                .create();

        for (long reader : new long[] {writer, rootAuthor, postAuthor}) {
            MvcResult page = api().list(login(reader), postId);
            assertThat((String) read(page, "$.items[0].replies[0].content")).isEqualTo("비밀답글XYZ");
        }
        MvcResult page = api().list(login(outsider), postId);
        assertThat(body(page)).doesNotContain("비밀답글XYZ");
        assertThat((String) read(page, "$.items[0].content")).isEqualTo("공개 최상위");
        assertThat((Boolean) read(page, "$.items[0].replies[0].secretLocked")).isTrue();
    }

    @Test
    void 답글_펼치기에서도_최상위_작성자는_비밀_답글을_읽는다() throws Exception {
        long rootAuthor = members().member().create();
        long root = comments().on(postId, rootAuthor).content("공개 최상위").at(BASE).create();
        for (int i = 0; i < 4; i++) {
            comments()
                    .on(postId, writer)
                    .parent(root)
                    .content("비밀답글" + i)
                    .secret()
                    .at(BASE.plusSeconds(1 + i))
                    .create();
        }
        String cursor = read(api().list(login(rootAuthor), postId), "$.items[0].repliesNextCursor");

        MvcResult mine = api().replies(login(rootAuthor), root, cursor);
        assertThat((String) read(mine, "$.items[0].content")).isEqualTo("비밀답글3");

        MvcResult other = api().replies(login(outsider), root, cursor);
        assertThat(body(other)).doesNotContain("비밀답글3");
        assertThat((Boolean) read(other, "$.items[0].secretLocked")).isTrue();
    }

    @Test
    void 답글_대상_회원도_비밀_답글을_읽는다() throws Exception {
        long target = members().member().create();
        long root = comments().on(postId, outsider).content("공개 최상위").at(BASE).create();
        comments()
                .on(postId, target)
                .parent(root)
                .content("대상 답글")
                .at(BASE.plusSeconds(1))
                .create();
        comments()
                .on(postId, writer)
                .parent(root)
                .replyTo(target)
                .content("대상에게비밀")
                .secret()
                .at(BASE.plusSeconds(2))
                .create();
        long stranger = members().member().create();

        assertThat(body(api().list(login(target), postId))).contains("대상에게비밀");
        assertThat(body(api().list(login(stranger), postId))).doesNotContain("대상에게비밀");
    }

    @Test
    void 못_읽는_비밀_댓글에는_답글을_달_수_없고_글_주인은_달_수_있다() throws Exception {
        long root = comments().on(postId, writer).content("비밀 최상위").secret().at(BASE).create();

        MvcResult refused = api().create(login(outsider), postId, "몰래 답글", root);
        assertThat(status(refused)).isEqualTo(400);
        assertThat((String) read(refused, "$.errors[0].code"))
                .isEqualTo("REPLY_TARGET_UNAVAILABLE");

        MvcResult reply = api().create(login(postAuthor), postId, "주인 답글", root, true);
        assertThat(status(reply)).isEqualTo(201);
        assertThat(body(api().list(login(writer), postId))).contains("주인 답글");
        assertThat(body(api().list(login(outsider), postId))).doesNotContain("주인 답글");
    }

    @Test
    void 수정에서_비밀을_풀면_모두_읽고_secret을_빼면_그대로() throws Exception {
        Cookie me = login(writer);
        long comment = id(api().create(me, postId, "처음엔 비밀", null, true));

        MvcResult kept = api().edit(me, comment, "고친 비밀");
        assertThat((Boolean) read(kept, "$.secret")).isTrue();
        assertThat(body(api().list(login(outsider), postId))).doesNotContain("고친 비밀");

        MvcResult opened = api().edit(me, comment, "고친 비밀", false);
        assertThat((Boolean) read(opened, "$.secret")).isFalse();
        assertThat((String) read(api().list(login(outsider), postId), "$.items[0].content"))
                .isEqualTo("고친 비밀");
    }

    @Test
    void 못_읽는_비밀_댓글은_신고할_수_없고_글_주인은_신고한다() throws Exception {
        long root = comments().on(postId, writer).content("신고 대상 비밀").secret().create();

        assertThat(report(login(outsider), root)).isEqualTo(404);
        assertThat(report(login(postAuthor), root)).isEqualTo(200);
    }

    private int report(Cookie session, long commentId) throws Exception {
        return mockMvc.perform(
                        TestLogin.withCsrf(post("/api/reports"), session)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(
                                        "{\"targetType\":\"COMMENT\",\"targetId\":"
                                                + commentId
                                                + ",\"reason\":\"SPAM\"}"))
                .andReturn()
                .getResponse()
                .getStatus();
    }
}
