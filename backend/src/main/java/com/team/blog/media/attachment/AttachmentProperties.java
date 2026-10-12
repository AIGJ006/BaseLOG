package com.team.blog.media.attachment;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * 글 첨부파일 설정값 ({@code blog.attachment.*}, 018 FR-003~FR-005, 헌법 VII). 기본값은 {@code application.yml}.
 *
 * @param maxBytes 파일 하나의 최대 크기 (V4 {@code ck_post_attachment_size} 10MB 이하)
 * @param maxPerPost 글 하나의 최대 첨부 수
 * @param perMinuteLimit 회원당 1분 업로드 수
 * @param allowedExtensions 받는 확장자 (소문자, 점 없이)
 * @param cleanupCron 지운 첨부의 저장소 파일 정리 시각
 */
@ConfigurationProperties("blog.attachment")
public record AttachmentProperties(
        long maxBytes,
        int maxPerPost,
        int perMinuteLimit,
        List<String> allowedExtensions,
        String cleanupCron) {

    /** V4 {@code ck_post_attachment_size}와 같은 값. */
    static final long DB_MAX_BYTES = 10_485_760L;

    public AttachmentProperties {
        if (maxBytes < 1 || maxBytes > DB_MAX_BYTES) {
            throw new IllegalStateException("blog.attachment.max-bytes는 1~10485760 사이여야 합니다");
        }
        if (maxPerPost < 1 || perMinuteLimit < 1) {
            throw new IllegalStateException("blog.attachment 개수 설정은 양수여야 합니다");
        }
        allowedExtensions = allowedExtensions == null ? List.of() : List.copyOf(allowedExtensions);
    }

    /** 소문자로 맞춘 확장자 집합. */
    public Set<String> extensions() {
        return allowedExtensions.stream()
                .map(e -> e.trim().toLowerCase(Locale.ROOT))
                .filter(e -> !e.isEmpty())
                .collect(Collectors.toUnmodifiableSet());
    }
}
