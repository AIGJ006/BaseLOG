package com.team.blog.post.domain;

/**
 * 글 공개 범위 (FR-001, research R-01). DB 문자열({@code post.visibility}, {@code
 * member.default_visibility})과 같은 이름이며 이 enum이 유일한 공개 범위 타입이다(001은 {@code
 * Member.defaultVisibility}를 문자열로 매핑한다).
 *
 * <p>{@link #PUBLIC}·{@link #FRIENDS}·{@link #PRIVATE} 셋을 쓴다. {@link #FRIENDS}(친구 공개)는 팀 공통 규격의 선택
 * 구현이었고 2026-10-13에 켰다 — {@code FriendsVisibilityRule} Bean과 Flyway {@code
 * V7__friends_visibility.sql}. {@code PROTECTED}는 쓰지 않는다.
 *
 * <p>요청 문자열을 이 enum으로 바꿀 때는 {@code valueOf}가 아니라 {@link VisibilityRegistry#require(String,
 * String)}를 쓴다 — 허용값은 등록된 {@link VisibilityRule} Bean 집합이다.
 */
public enum Visibility {
    /** 전체 공개. */
    PUBLIC,
    /** 나만 보기. */
    PRIVATE,
    /** 친구 공개 (작성자 + 수락된 친구). */
    FRIENDS
}
