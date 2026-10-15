package com.team.blog.inquiry.infra;

import com.team.blog.inquiry.domain.InquiryCategory;
import com.team.blog.inquiry.domain.InquiryStatus;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 문의 저장과 조회 (023). 이 모듈의 {@code inquiry} 테이블만 읽고 쓴다. */
@Repository
public class InquiryRepository {

    private static final String MEMBER = "member";
    private static final String SELECT =
            "SELECT id, member_id, category, content, target_handle, image_id, status, answer,"
                    + " answered_at, created_at FROM inquiry";

    private final JdbcClient jdbc;

    public InquiryRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 문의 한 줄. */
    public record InquiryRow(
            long id,
            long memberId,
            InquiryCategory category,
            String content,
            String targetHandle,
            Long imageId,
            InquiryStatus status,
            String answer,
            Instant answeredAt,
            Instant createdAt) {}

    /**
     * @return 새 문의 번호
     */
    public long insert(
            long memberId,
            InquiryCategory category,
            String content,
            String targetHandle,
            Long imageId,
            Instant now) {
        return jdbc.sql(
                        """
                        INSERT INTO inquiry (member_id, category, content, target_handle, image_id, created_at)
                        VALUES (:member, :category, :content, :target, :image, :now)
                        RETURNING id
                        """)
                .param(MEMBER, memberId)
                .param("category", category.name())
                .param("content", content)
                .param("target", targetHandle)
                .param("image", imageId)
                .param("now", Timestamp.from(now))
                .query(Long.class)
                .single();
    }

    public Optional<InquiryRow> find(long id) {
        return jdbc.sql(SELECT + " WHERE id = :id")
                .param("id", id)
                .query(InquiryRepository::map)
                .optional();
    }

    /** 같은 문의에 두 관리자가 동시에 답할 때 한 줄로 세운다. */
    public Optional<InquiryRow> lock(long id) {
        return jdbc.sql(SELECT + " WHERE id = :id FOR UPDATE")
                .param("id", id)
                .query(InquiryRepository::map)
                .optional();
    }

    /** 내가 보낸 문의 (새것부터 {@code limit}개). */
    public List<InquiryRow> listByMember(long memberId, int limit) {
        return jdbc.sql(SELECT + " WHERE member_id = :member ORDER BY id DESC LIMIT :limit")
                .param(MEMBER, memberId)
                .param("limit", limit)
                .query(InquiryRepository::map)
                .list();
    }

    /**
     * 관리자 목록 (새것부터). {@code status}가 {@code null}이면 전부, {@code before}가 있으면 그 번호보다 앞선 것만.
     *
     * @param limit 가져올 수 (다음 쪽이 있는지 보려면 한 쪽 크기 + 1)
     */
    public List<InquiryRow> listForAdmin(InquiryStatus status, Long before, int limit) {
        StringBuilder sql = new StringBuilder(SELECT).append(" WHERE TRUE");
        if (status != null) {
            sql.append(" AND status = :status");
        }
        if (before != null) {
            sql.append(" AND id < :before");
        }
        sql.append(" ORDER BY id DESC LIMIT :limit");
        JdbcClient.StatementSpec spec = jdbc.sql(sql.toString()).param("limit", limit);
        if (status != null) {
            spec = spec.param("status", status.name());
        }
        if (before != null) {
            spec = spec.param("before", before);
        }
        return spec.query(InquiryRepository::map).list();
    }

    /** 답을 저장하고 답변 완료로 바꾼다. 이미 답한 문의면 답만 고친다(처음 답한 시각은 그대로). */
    public void saveAnswer(long id, String answer, long adminId, Instant now) {
        jdbc.sql(
                        """
                        UPDATE inquiry SET answer = :answer, answered_by = :admin, status = 'ANSWERED',
                               answered_at = COALESCE(answered_at, :now)
                         WHERE id = :id
                        """)
                .param("answer", answer)
                .param("admin", adminId)
                .param("now", Timestamp.from(now))
                .param("id", id)
                .update();
    }

    /** 탈퇴 정리: 그 회원이 보낸 문의 전부 삭제. */
    public int deleteAllByMember(long memberId) {
        return jdbc.sql("DELETE FROM inquiry WHERE member_id = :member")
                .param(MEMBER, memberId)
                .update();
    }

    private static InquiryRow map(ResultSet rs, int rowNum) throws SQLException {
        long imageId = rs.getLong("image_id");
        Long image = rs.wasNull() ? null : imageId;
        return new InquiryRow(
                rs.getLong("id"),
                rs.getLong("member_id"),
                InquiryCategory.valueOf(rs.getString("category")),
                rs.getString("content"),
                rs.getString("target_handle"),
                image,
                InquiryStatus.valueOf(rs.getString("status")),
                rs.getString("answer"),
                instant(rs.getTimestamp("answered_at")),
                rs.getTimestamp("created_at").toInstant());
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }
}
