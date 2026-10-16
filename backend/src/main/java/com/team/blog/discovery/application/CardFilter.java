package com.team.blog.discovery.application;

import java.util.List;

/**
 * 카드 목록의 추가 조건 (005 카드 조회 + 008 태그 + 친구 피드(020, 옛 010 팔로우 피드), 008 research R6). 노출 조건(004 {@code
 * VisibilityFilter})은 이와 별개로 항상 붙는다.
 *
 * @param authorId 블로그 주인 (전체 목록이면 {@code null})
 * @param tagId 이 태그가 붙은 글만 (조건 없음이면 {@code null})
 * @param friendOf 이 회원과 친구({@code ACCEPTED})인 작성자의 글만 (020 피드, 조건 없음이면 {@code null})
 * @param categoryIds 이 카테고리들 중 하나에 든 글만 (017 블로그 카테고리 필터 — 최상위면 자기 + 하위, 조건 없음이면 {@code null})
 * @param pins 029 고정 글 조건 ({@link Pins#ANY}면 조건 없음)
 */
public record CardFilter(
        Long authorId, Long tagId, Long friendOf, List<Long> categoryIds, Pins pins) {

    /** 029 고정 글 조건. */
    public enum Pins {
        /** 고정 여부를 보지 않는다. */
        ANY,
        /** 고정 안 한 글만 (둥지 첫 목록 — 고정 글은 맨 위에 따로 보인다). */
        EXCLUDE,
        /** 고정 글만, 최근 고정한 순 (커서 없음). */
        ONLY
    }

    public CardFilter {
        categoryIds = categoryIds == null ? null : List.copyOf(categoryIds);
        pins = pins == null ? Pins.ANY : pins;
    }

    /** 블로그·태그·친구·카테고리 조건 (017). 고정 조건 없음. */
    public CardFilter(Long authorId, Long tagId, Long friendOf, List<Long> categoryIds) {
        this(authorId, tagId, friendOf, categoryIds, Pins.ANY);
    }

    /** 블로그·태그·친구 조건 (008·020). 카테고리 조건 없음. */
    public CardFilter(Long authorId, Long tagId, Long friendOf) {
        this(authorId, tagId, friendOf, null);
    }

    /** 블로그·태그 조건 (008). 친구 조건 없음. */
    public CardFilter(Long authorId, Long tagId) {
        this(authorId, tagId, null, null);
    }

    /** 한 블로그의 카테고리 글 (017). */
    public static CardFilter authorInCategories(long authorId, List<Long> categoryIds) {
        return new CardFilter(authorId, null, null, categoryIds);
    }

    /** 전체 목록 (홈). */
    public static CardFilter all() {
        return new CardFilter(null, null, null);
    }

    /** 한 블로그의 글. */
    public static CardFilter author(long authorId) {
        return new CardFilter(authorId, null, null);
    }

    /** 한 블로그의 고정 안 한 글 (029 둥지 첫 목록). */
    public static CardFilter authorUnpinned(long authorId) {
        return new CardFilter(authorId, null, null, null, Pins.EXCLUDE);
    }

    /** 한 블로그의 고정 글 (029). */
    public static CardFilter authorPinned(long authorId) {
        return new CardFilter(authorId, null, null, null, Pins.ONLY);
    }

    /** 이 회원의 친구들 글 (020 피드). */
    public static CardFilter friendsOf(long memberId) {
        return new CardFilter(null, null, memberId);
    }
}
