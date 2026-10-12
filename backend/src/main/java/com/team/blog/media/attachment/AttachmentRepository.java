package com.team.blog.media.attachment;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * {@code post_attachment}·{@code attachment_trash} (018 V4). 행을 지우면 트리거가 키를 {@code
 * attachment_trash}에 남긴다.
 */
@Repository
public class AttachmentRepository {

    private static final String COLUMNS =
            "id, post_id, storage_key, original_name, size_bytes, created_at";

    private final JdbcClient jdbc;

    public AttachmentRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 같은 글의 첨부 추가끼리 줄 세우기 (트랜잭션 끝까지). 개수 한도를 동시에 넘지 않게 한다. */
    public void lockPost(long postId) {
        jdbc.sql("SELECT pg_advisory_xact_lock(hashtextextended('post_attachment:' || :postId, 0))")
                .param("postId", postId)
                .query(Object.class)
                .list();
    }

    public int countByPost(long postId) {
        return jdbc.sql("SELECT count(*) FROM post_attachment WHERE post_id = :postId")
                .param("postId", postId)
                .query(Integer.class)
                .single();
    }

    public Attachment insert(long postId, String storageKey, String name, long size) {
        return jdbc.sql(
                        "INSERT INTO post_attachment (post_id, storage_key, original_name, size_bytes)"
                                + " VALUES (:postId, :key, :name, :size) RETURNING "
                                + COLUMNS)
                .param("postId", postId)
                .param("key", storageKey)
                .param("name", name)
                .param("size", size)
                .query(AttachmentRepository::map)
                .single();
    }

    public List<Attachment> findByPost(long postId) {
        return jdbc.sql(
                        "SELECT "
                                + COLUMNS
                                + " FROM post_attachment WHERE post_id = :postId ORDER BY id")
                .param("postId", postId)
                .query(AttachmentRepository::map)
                .list();
    }

    public Optional<Attachment> find(long postId, long attachmentId) {
        return jdbc.sql(
                        "SELECT "
                                + COLUMNS
                                + " FROM post_attachment WHERE id = :id AND post_id = :postId")
                .param("id", attachmentId)
                .param("postId", postId)
                .query(AttachmentRepository::map)
                .optional();
    }

    /**
     * @return 지운 행의 저장소 키 (없으면 빈 값)
     */
    public Optional<String> delete(long postId, long attachmentId) {
        return jdbc.sql(
                        "DELETE FROM post_attachment WHERE id = :id AND post_id = :postId"
                                + " RETURNING storage_key")
                .param("id", attachmentId)
                .param("postId", postId)
                .query(String.class)
                .optional();
    }

    /** 지울 파일 키 (오래된 것부터). */
    public List<String> findTrash(int limit) {
        return jdbc.sql("SELECT storage_key FROM attachment_trash ORDER BY queued_at LIMIT :limit")
                .param("limit", limit)
                .query(String.class)
                .list();
    }

    /** 저장소에서 지운 키를 목록에서 뺀다. */
    public void removeTrash(Collection<String> keys) {
        if (keys.isEmpty()) {
            return;
        }
        jdbc.sql("DELETE FROM attachment_trash WHERE storage_key IN (:keys)")
                .param("keys", keys)
                .update();
    }

    /** 저장소에 올렸지만 행을 만들지 못한 파일을 지울 목록에 넣는다. */
    public void queueTrash(String key) {
        jdbc.sql("INSERT INTO attachment_trash (storage_key) VALUES (:key) ON CONFLICT DO NOTHING")
                .param("key", key)
                .update();
    }

    private static Attachment map(ResultSet rs, int row) throws SQLException {
        Timestamp created = rs.getTimestamp("created_at");
        return new Attachment(
                rs.getLong("id"),
                rs.getLong("post_id"),
                rs.getString("storage_key"),
                rs.getString("original_name"),
                rs.getLong("size_bytes"),
                created == null ? Instant.EPOCH : created.toInstant());
    }
}
