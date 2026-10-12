package com.team.blog.discovery.application;

import com.team.blog.account.application.FriendshipQueryService;
import com.team.blog.shared.security.Viewer;
import com.team.blog.shared.web.cursor.ListScope;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 친구 피드 (020, 옛 010 팔로잉 피드 자리). 005 카드 목록에 친구 조건({@link CardFilter#friendsOf})만 더한다 — 노출 조건은 004
 * {@code VisibilityFilter}의 전체 공개 목록 조건(공개·발행·휴지통 아님·숨김 아님·작성자 탈퇴 유예 아님)이고 정렬·9개·커서 규칙은 홈과 같다(커서 범위
 * {@code feed}).
 *
 * <p>SQL: 카드 1번(사진 포함) + 첫 페이지가 비었을 때만 친구 여부 1번({@code hasFriends}). 그 밖에는 {@code hasFriends =
 * true}로 두어 SQL을 아낀다.
 */
@Service
@Transactional(readOnly = true)
public class FeedQueryService {

    private final PostListService lists;
    private final FriendshipQueryService friendships;

    public FeedQueryService(PostListService lists, FriendshipQueryService friendships) {
        this.lists = lists;
        this.friendships = friendships;
    }

    /**
     * 피드 한 페이지 (contracts {@code FeedPage}).
     *
     * @param nextCursor 더 있으면 다음 페이지 위치, 끝이면 {@code null}
     * @param hasFriends 친구가 한 명이라도 있는가 (첫 페이지가 비었을 때만 실제 값)
     */
    public record FeedPage(List<PostCardView> items, String nextCursor, boolean hasFriends) {}

    /**
     * @param me 로그인한 회원 번호
     * @param cursor 이전 응답의 {@code nextCursor} (첫 페이지면 {@code null})
     */
    public FeedPage page(long me, String cursor) {
        CursorPage<PostCardView> page =
                lists.page(ListScope.feed(), CardFilter.friendsOf(me), cursor, Viewer.anonymous());
        boolean firstPage = cursor == null || cursor.isEmpty();
        boolean hasFriends = !(firstPage && page.items().isEmpty()) || friendships.hasFriends(me);
        return new FeedPage(page.items(), page.nextCursor(), hasFriends);
    }
}
