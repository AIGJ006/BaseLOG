package com.team.blog.media.attachment;

import java.time.Instant;

/**
 * 글에 붙은 첨부파일 한 개.
 *
 * @param id 첨부 번호
 * @param postId 글 번호
 * @param storageKey 저장소 키 (응답에 싣지 않는다)
 * @param name 원래 파일 이름 (다듬은 값)
 * @param size 바이트 수
 * @param createdAt 올린 시각
 */
public record Attachment(
        long id, long postId, String storageKey, String name, long size, Instant createdAt) {}
