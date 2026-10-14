package com.team.blog.media.application;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * 문의에 붙이는 사진 (023). 글 사진과 같은 방법(presign → 올리기 → complete)으로 올린 사진 한 장을 문의에 붙인다. 붙이면 {@code
 * ATTACHED}·{@code detached_at = NULL}이 돼 24시간 TEMP 정리에 걸리지 않는다. 탈퇴하면 015 {@link
 * ImageWithdrawalPurgeStep}이 다른 사진과 함께 연결 해제로 표시하고, 사진 정리가 지우면 문의의 사진 칸은 비워진다(FK {@code SET NULL}).
 */
@Service
public class InquiryImageService {

    private final JdbcClient jdbc;
    private final ImageUrlResolver urls;

    public InquiryImageService(JdbcClient jdbc, ImageUrlResolver urls) {
        this.jdbc = jdbc;
        this.urls = urls;
    }

    /**
     * 내가 올리고 완료 확인까지 마친 글 사진이면 붙은 것으로 표시한다 (트랜잭션 안에서 부른다).
     *
     * @return 붙였으면 {@code true}. 남의 사진·완료 전·없는 번호는 {@code false}
     */
    public boolean attach(long uploaderId, long imageId) {
        return jdbc.sql(
                                """
                                UPDATE image SET status = 'ATTACHED', detached_at = NULL
                                 WHERE id = :id AND uploader_id = :uploader AND purpose = 'POST'
                                   AND width IS NOT NULL
                                """)
                        .param("id", imageId)
                        .param("uploader", uploaderId)
                        .update()
                > 0;
    }

    /** 사진 번호 → 공개 주소 (SQL 1번). 없는 번호는 결과에 없다. 빈 입력은 SQL 없이 빈 맵. */
    public Map<Long, String> publicUrlsOf(Collection<Long> imageIds) {
        Map<Long, String> result = new LinkedHashMap<>();
        if (imageIds == null || imageIds.isEmpty()) {
            return result;
        }
        jdbc.sql("SELECT id, storage_key FROM image WHERE id IN (:ids)")
                .param("ids", imageIds)
                .query(
                        rs -> {
                            result.put(
                                    rs.getLong("id"), urls.publicUrl(rs.getString("storage_key")));
                        });
        return result;
    }
}
