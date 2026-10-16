package com.team.blog.notification.domain;

/**
 * 알림 종류 10개 (011 data-model §2, V22 {@code ck_notification_type}과 같은 순서). 020에서 팔로우를 빼고 친구로 바꾸며 새
 * 팔로워({@code FOLLOW})를 지우고 친구 요청·수락을 더했다(2026-10-12). 023에서 문의 답변을, 030에서 공동 작업자 추가를
 * 더했다(2026-10-14·16).
 */
public enum NotificationType {
    /** 내 글에 달린 댓글. */
    COMMENT,
    /** 내 댓글에 달린 답글. */
    REPLY,
    /** 내 글 좋아요 (글마다 묶음). */
    LIKE,
    /** 받은 친구 요청 (한 건짜리). */
    FRIEND_REQUEST,
    /** 내가 보낸 친구 요청을 상대가 수락함 (한 건짜리). */
    FRIEND_ACCEPTED,
    /** 친구의 새 글. */
    NEW_POST,
    /** 내 신고의 처리 결과 (운영 알림). */
    REPORT_RESOLVED,
    /** 내 글·댓글 숨김 (운영 알림). */
    CONTENT_HIDDEN,
    /** 내 문의에 관리자가 답함 (운영 알림, 023). */
    INQUIRY_ANSWERED,
    /** 글쓴이가 나를 그 글의 공동 작업자로 더함 (한 건짜리, 끌 수 없음, 030). */
    COLLABORATOR_ADDED;

    /** 운영 알림인가 — 끌 수 없고 행동자가 없다(FR-022). */
    public boolean isOperational() {
        return this == REPORT_RESOLVED || this == CONTENT_HIDDEN || this == INQUIRY_ANSWERED;
    }

    /** 사람이 묶이는 알림인가 ({@code notification_actor}·{@code group_key}를 쓴다). */
    public boolean isGrouped() {
        return this == LIKE;
    }

    /** 만들 때 받는 사람이 그 글을 읽을 수 있어야 하는가 (공통 제외 규칙 ⑤ — {@code NEW_POST}는 비회원 기준 한 번으로 대신). */
    public boolean needsReadablePost() {
        return this == COMMENT
                || this == REPLY
                || this == LIKE
                || this == NEW_POST
                || this == COLLABORATOR_ADDED;
    }

    /** 끌 수 있는 종류면 그 값, 운영 알림·공동 작업자 추가면 {@code null}. */
    public MutableType mutable() {
        return isOperational() || this == COLLABORATOR_ADDED ? null : MutableType.valueOf(name());
    }
}
