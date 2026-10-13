package com.team.blog.nest.domain;

/** 포인트 기록의 까닭 (V9 {@code ck_nest_point_reason}). */
public enum NestPointReason {
    /** 하루 첫 출석 */
    ATTENDANCE,
    /** 연속 출석 보너스 (7일마다) */
    STREAK_BONUS,
    /** 글 등록(첫 발행) */
    POST,
    /** 댓글·답글 쓰기 */
    COMMENT,
    /** 내 글이 받은 좋아요 (다른 사람 1명당) */
    LIKE_RECEIVED,
    /** 상점에서 사기 (음수) */
    PURCHASE,
    /** 되돌리기·손으로 고치기 */
    ADJUST
}
