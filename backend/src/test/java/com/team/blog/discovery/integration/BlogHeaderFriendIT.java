package com.team.blog.discovery.integration;

import static com.team.blog.discovery.support.ReadingApi.body;
import static com.team.blog.discovery.support.ReadingApi.read;
import static com.team.blog.discovery.support.ReadingApi.status;
import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.discovery.support.ReadingApi;
import com.team.blog.interaction.support.FollowFixtures;
import com.team.blog.support.FriendApi;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.FriendFixtures;
import com.team.blog.support.fixture.PostFixtures;
import jakarta.servlet.http.Cookie;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 블로그 머리말의 친구 수와 글 상세의 옛 팔로우 칸 (020, 옛 010 T015 자리). 005 기존 칸은 그대로다. 팔로우는 빠져 {@code follow} 행이 있어도
 * 어디에도 보이지 않는다.
 */
class BlogHeaderFriendIT extends IntegrationTestBase {

    private long owner;
    private long me;
    private Cookie session;

    @BeforeEach
    void setUp() {
        owner = members().member().handle("owner_b").nickname("주인").create();
        me = members().member().handle("viewer_me").create();
        session = TestLogin.loginAs(mockMvc, me);
    }

    private ReadingApi reading() {
        return new ReadingApi(mockMvc);
    }

    private FriendFixtures friends() {
        return new FriendFixtures(jdbc);
    }

    private static long number(MvcResult result, String path) {
        return ((Number) read(result, path)).longValue();
    }

    @Test
    void 머리말의_친구_수는_수락한_친구만이고_탈퇴_유예는_빠진다() throws Exception {
        long f1 = members().member().create();
        long f2 = members().member().create();
        long leaving = members().member().create();
        long requested = members().member().create();
        friends().friends(f1, owner);
        friends().friends(owner, f2);
        friends().friends(leaving, owner);
        friends().request(requested, owner);
        new FollowFixtures(jdbc).follow(members().member().create(), owner);
        new FollowFixtures(jdbc).withdraw(leaving);

        MvcResult anonymous = reading().blogHeader(null, "owner_b");
        assertThat(status(anonymous)).as(body(anonymous)).isEqualTo(200);
        assertThat(number(anonymous, "$.friendCount")).isEqualTo(2);

        new FollowFixtures(jdbc).restore(leaving);
        assertThat(number(reading().blogHeader(null, "owner_b"), "$.friendCount")).isEqualTo(3);
    }

    @Test
    void 요청하고_수락하면_양쪽_친구_수가_는다() throws Exception {
        FriendApi api = new FriendApi(mockMvc);
        api.request(session, "owner_b");
        assertThat(number(reading().blogHeader(session, "owner_b"), "$.friendCount")).isZero();

        api.request(TestLogin.loginAs(mockMvc, owner), "viewer_me");

        assertThat(number(reading().blogHeader(session, "owner_b"), "$.friendCount")).isEqualTo(1);
        assertThat(number(reading().blogHeader(null, "viewer_me"), "$.friendCount")).isEqualTo(1);

        api.remove(session, "owner_b");
        assertThat(number(reading().blogHeader(null, "owner_b"), "$.friendCount")).isZero();
    }

    @Test
    void 머리말_칸은_005_칸에_friendCount와_025_배너만_더한다() throws Exception {
        jdbc.update("UPDATE member SET bio = '소개' WHERE id = ?", owner);
        new PostFixtures(jdbc).create(owner, PostFixtures.State.PUBLISHED_PUBLIC);

        MvcResult result = reading().blogHeader(null, "owner_b");

        Map<String, Object> header = read(result, "$");
        assertThat(header)
                .containsOnlyKeys(
                        "handle",
                        "nickname",
                        "bio",
                        "profileImageUrl",
                        "publicPostCount",
                        "isMe",
                        "friendCount",
                        "bannerImageUrl");
        assertThat(header.get("handle")).isEqualTo("owner_b");
        assertThat(header.get("nickname")).isEqualTo("주인");
        assertThat(header.get("bio")).isEqualTo("소개");
        assertThat(((Number) header.get("publicPostCount")).intValue()).isEqualTo(1);
        assertThat(header.get("isMe")).isEqualTo(false);
        assertThat(header.get("bannerImageUrl")).isNull();
        assertThat(ReadingApi.cacheControl(result)).isEqualTo("private, no-cache");
    }

    @Test
    void 글_상세의_followingAuthor는_친구여도_팔로우_행이_있어도_false() throws Exception {
        long postId = new PostFixtures(jdbc).create(owner, PostFixtures.State.PUBLISHED_PUBLIC);
        friends().friends(me, owner);
        new FollowFixtures(jdbc).follow(me, owner);

        assertThat((Boolean) read(reading().detail(session, postId), "$.viewer.followingAuthor"))
                .isFalse();
        assertThat((Boolean) read(reading().detail(null, postId), "$.viewer.followingAuthor"))
                .isFalse();
    }
}
