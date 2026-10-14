package com.team.blog.spellcheck.application;

/** {@code POST /api/posts/{postId}/spell-check} 본문 — 에디터의 지금 본문(저장 안 된 것 포함). */
public record SpellCheckRequest(String contentMd) {
    public SpellCheckRequest {
        contentMd = contentMd == null ? "" : contentMd;
    }
}
