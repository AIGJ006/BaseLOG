package com.team.blog.interaction.domain;

/**
 * 비밀 댓글을 읽을 수 있는 사람 (007 비밀 댓글, 2026-10-13). 공개 댓글은 누구나 읽는다.
 *
 * <p>비밀 댓글은 댓글 작성자·글 작성자만, 비밀 답글은 거기에 최상위 댓글 작성자와 답글 대상 회원을 더한다. 관리자도 글 화면에서는 남과 같다 — 신고된 비밀 댓글의
 * 내용은 신고 처리 화면에서 본다.
 */
public final class SecretComment {

    private SecretComment() {}

    /**
     * @param viewerId 보는 회원 (비회원은 {@code null})
     * @param rootAuthorId 답글이면 최상위 댓글 작성자, 최상위면 {@code null}
     * @param replyToMemberId 답글 대상 회원 (없으면 {@code null})
     */
    public static boolean readable(
            boolean secret,
            Long viewerId,
            long authorId,
            long postAuthorId,
            Long rootAuthorId,
            Long replyToMemberId) {
        if (!secret) {
            return true;
        }
        if (viewerId == null) {
            return false;
        }
        long me = viewerId;
        return me == authorId
                || me == postAuthorId
                || (rootAuthorId != null && me == rootAuthorId)
                || (replyToMemberId != null && me == replyToMemberId);
    }
}
