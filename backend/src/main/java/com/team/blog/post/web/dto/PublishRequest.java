package com.team.blog.post.web.dto;

import java.util.List;

/**
 * 발행 요청 (contracts {@code PublishRequest}). 칸 검증은 서비스({@code PublishValidator})가 모아서 한다.
 *
 * @param baseVersion 이 내용이 출발한 서버 편집 버전 (없으면 0)
 * @param thumbnailUrl 고른 썸네일 사진의 원본 주소, 지정 없음이면 {@code null} (019)
 */
public record PublishRequest(
        String title,
        String contentMd,
        List<String> tags,
        String visibility,
        Long baseVersion,
        String thumbnailUrl) {

    public PublishRequest(
            String title,
            String contentMd,
            List<String> tags,
            String visibility,
            Long baseVersion) {
        this(title, contentMd, tags, visibility, baseVersion, null);
    }
}
