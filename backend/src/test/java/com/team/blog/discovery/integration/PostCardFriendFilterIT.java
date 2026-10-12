package com.team.blog.discovery.integration;

import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.discovery.application.CardFilter;
import com.team.blog.discovery.infra.PostCardQueryRepository;
import com.team.blog.discovery.infra.PostCardRow;
import com.team.blog.interaction.support.FollowFixtures;
import com.team.blog.shared.security.Viewer;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.fixture.FriendFixtures;
import com.team.blog.support.fixture.PostFixtures;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * 카드 조회의 친구 조건 (020, 옛 010 T005 팔로우 조건 자리). {@code CardFilter(friendOf = A)}는 A와 친구({@code
 * ACCEPTED})인 작성자의 공개 발행 글만이고, 수락 전 요청은 빠지며, 친구 조건 없는 호출(홈·블로그·008 태그)은 그대로다 — 005 {@code
 * HomeListIntegrationTest}·{@code BlogPageIntegrationTest}·{@code
 * PostCardQueryRepositoryIntegrationTest}와 008 {@code PostCardTagFilterIT}를 함께 돌린다.
 */
class PostCardFriendFilterIT extends IntegrationTestBase {

    @Autowired private PostCardQueryRepository repository;

    private long a;
    private long b;
    private long c;
    private long stranger;
    private long pending;
    private long bPublic1;
    private long bPublic2;
    private long cPublic;
    private long strangerPublic;
    private long aOwn;
    private long pendingPublic;

    @BeforeEach
    void seed() {
        PostFixtures posts = new PostFixtures(jdbc);
        FriendFixtures friends = new FriendFixtures(jdbc);
        a = members().member().create();
        b = members().member().create();
        c = members().member().create();
        stranger = members().member().create();
        pending = members().member().create();
        Instant base = Instant.now().minus(Duration.ofDays(3)).truncatedTo(ChronoUnit.MICROS);
        bPublic1 = posts.post(b).published("PUBLIC").firstPublicAt(base).title("B 1").create();
        bPublic2 =
                posts.post(b)
                        .published("PUBLIC")
                        .firstPublicAt(base.plusSeconds(10))
                        .title("B 2")
                        .create();
        cPublic =
                posts.post(c)
                        .published("PUBLIC")
                        .firstPublicAt(base.plusSeconds(20))
                        .title("C")
                        .create();
        strangerPublic =
                posts.post(stranger)
                        .published("PUBLIC")
                        .firstPublicAt(base.plusSeconds(30))
                        .title("남")
                        .create();
        aOwn =
                posts.post(a)
                        .published("PUBLIC")
                        .firstPublicAt(base.plusSeconds(40))
                        .title("A 자신")
                        .create();
        posts.post(b).published("PRIVATE").title("B 비공개").create();
        posts.post(b).title("B 임시").create();
        posts.post(b).published("PUBLIC").firstPublicAt(base).trashed().title("B 휴지통").create();
        posts.post(c).published("PUBLIC").firstPublicAt(base).hidden().title("C 숨김").create();
        pendingPublic =
                posts.post(pending)
                        .published("PUBLIC")
                        .firstPublicAt(base.plusSeconds(50))
                        .title("요청만")
                        .create();
        friends.friends(a, b);
        friends.friends(c, a);
        friends.request(a, pending);
    }

    private List<Long> ids(CardFilter filter) {
        return repository.findCards(Viewer.anonymous(), filter, null, 50).stream()
                .map(PostCardRow::id)
                .toList();
    }

    @Test
    void 친구의_공개_발행_글만_최신순이고_수락_전_요청은_빠진다() {
        assertThat(ids(CardFilter.friendsOf(a))).containsExactly(cPublic, bPublic2, bPublic1);
    }

    @Test
    void 탈퇴_유예_작성자의_글은_빠진다() {
        new FollowFixtures(jdbc).withdraw(c);
        assertThat(ids(CardFilter.friendsOf(a))).containsExactly(bPublic2, bPublic1);
    }

    @Test
    void 친구가_없으면_빈_목록이고_친구_관계는_양쪽에서_같다() {
        assertThat(ids(CardFilter.friendsOf(stranger))).isEmpty();
        assertThat(ids(CardFilter.friendsOf(pending))).isEmpty();
        assertThat(ids(CardFilter.friendsOf(b))).containsExactly(aOwn);
        assertThat(ids(CardFilter.friendsOf(c))).containsExactly(aOwn);
    }

    @Test
    void 친구_조건_없는_호출은_그대로() {
        assertThat(ids(CardFilter.all()))
                .containsExactly(pendingPublic, aOwn, strangerPublic, cPublic, bPublic2, bPublic1);
        assertThat(ids(CardFilter.author(b))).containsExactly(bPublic2, bPublic1);
        assertThat(ids(new CardFilter(b, null))).containsExactly(bPublic2, bPublic1);
    }

    @Test
    void 블로그_조건과_함께면_그_블로그만() {
        assertThat(ids(new CardFilter(c, null, a))).containsExactly(cPublic);
        assertThat(ids(new CardFilter(stranger, null, a))).isEmpty();
    }
}
