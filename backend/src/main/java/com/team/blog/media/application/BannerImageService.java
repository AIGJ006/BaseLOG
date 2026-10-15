package com.team.blog.media.application;

import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.ValidationException;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 둥지 배너 연결·조회 (025). 프로필 사진({@link DefaultProfileImageService}·{@link ProfileImageQuery})과 같은 규칙이다.
 *
 * <p>지금 배너 = {@code uq_image_banner_current} 조건({@code purpose = 'BANNER' AND status = 'ATTACHED'
 * AND detached_at IS NULL})의 행 하나. 붙일 수 있는 사진 = 그 회원이 올린 {@code purpose = 'BANNER'}이면서 완료 확인(정확히
 * 1500×375·WebP/JPEG)을 통과한 것({@code width IS NOT NULL}).
 *
 * <p>{@link #attach}·{@link #detach}는 account 프로필 저장 트랜잭션 안에서, 회원 행을 {@code FOR UPDATE}로 잠근 뒤 부른다 —
 * 같은 회원의 저장이 직렬화되어 부분 유일 인덱스가 깨지지 않는다. 순서는 "떼기 → 붙이기"다. 뗀 사진은 정리 작업이 7일 뒤 지우고, 탈퇴하면 {@link
 * ImageWithdrawalPurgeStep}이 다른 사진과 함께 정리한다.
 */
@Service
public class BannerImageService {

    /** 칸 오류 코드 ({@code PATCH /api/me/profile} 400). */
    public static final String INVALID_BANNER_IMAGE = "INVALID_BANNER_IMAGE";

    public static final String INVALID_BANNER_IMAGE_MESSAGE = "사용할 수 없는 사진이에요";

    /** 칸 이름 ({@code ProfileUpdateRequest.bannerImageId}). */
    public static final String FIELD = "bannerImageId";

    private final JdbcClient jdbc;

    public BannerImageService(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 그 회원이 올린 완료된 배너 사진인가 (저장 전 검사 — 오류를 다른 칸과 함께 모으기 위해). */
    @Transactional(readOnly = true)
    public boolean isAttachable(long memberId, long imageId) {
        return jdbc.sql(
                                """
                                SELECT count(*) FROM image
                                 WHERE id = :id AND uploader_id = :me AND purpose = 'BANNER'
                                   AND width IS NOT NULL
                                """)
                        .param("id", imageId)
                        .param("me", memberId)
                        .query(Long.class)
                        .single()
                > 0;
    }

    /**
     * 이전 배너를 떼고 새 배너를 붙인다.
     *
     * @throws ValidationException 400 {@code INVALID_BANNER_IMAGE} — 남의 사진·다른 용도 사진·없는 사진
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void attach(long memberId, long imageId) {
        Optional<Long> current = currentImageId(memberId);
        if (current.isPresent() && current.get() == imageId) {
            return;
        }
        detach(memberId);
        int updated =
                jdbc.sql(
                                """
                                UPDATE image SET status = 'ATTACHED', detached_at = NULL
                                 WHERE id = :id AND uploader_id = :me AND purpose = 'BANNER'
                                   AND width IS NOT NULL
                                """)
                        .param("id", imageId)
                        .param("me", memberId)
                        .update();
        if (updated == 0) {
            throw new ValidationException(
                    List.of(
                            new FieldError(
                                    FIELD, INVALID_BANNER_IMAGE, INVALID_BANNER_IMAGE_MESSAGE)));
        }
    }

    /** 지금 배너를 뗀다(기본 배경으로). 없으면 아무것도 하지 않는다. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void detach(long memberId) {
        jdbc.sql(
                        """
                        UPDATE image SET detached_at = now()
                         WHERE uploader_id = :me AND purpose = 'BANNER'
                           AND status = 'ATTACHED' AND detached_at IS NULL
                        """)
                .param("me", memberId)
                .update();
    }

    /** 지금 배너 사진 번호. */
    @Transactional(readOnly = true)
    public Optional<Long> currentImageId(long memberId) {
        return jdbc.sql(
                        """
                        SELECT id FROM image
                         WHERE uploader_id = :me AND purpose = 'BANNER'
                           AND status = 'ATTACHED' AND detached_at IS NULL
                        """)
                .param("me", memberId)
                .query(Long.class)
                .optional();
    }

    /** 지금 배너(번호·저장소 키, 썸네일 없음). 없으면 비어 있다. */
    @Transactional(readOnly = true)
    public Optional<CurrentBanner> current(long memberId) {
        return jdbc.sql(
                        """
                        SELECT id, storage_key FROM image
                         WHERE uploader_id = :me AND purpose = 'BANNER'
                           AND status = 'ATTACHED' AND detached_at IS NULL
                        """)
                .param("me", memberId)
                .query((rs, n) -> new CurrentBanner(rs.getLong("id"), rs.getString("storage_key")))
                .optional();
    }

    /**
     * 지금 배너.
     *
     * @param imageId 사진 번호
     * @param storageKey {@code image.storage_key}
     */
    public record CurrentBanner(long imageId, String storageKey) {}
}
