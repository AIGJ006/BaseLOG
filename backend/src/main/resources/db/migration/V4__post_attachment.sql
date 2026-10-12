-- 018 글 첨부파일 (나민서 개인 확장, specs/018-attachment). 공통 ERD는 바꾸지 않고 새 테이블만 더한다(constitution I).
-- 파일은 사진 저장소(같은 버킷)의 attachments/ 아래에 두고 익명 읽기를 열지 않는다. 내려받기는 앱이 권한을 확인한 뒤 전달한다.

CREATE TABLE post_attachment (
    id             bigint GENERATED ALWAYS AS IDENTITY,
    post_id        bigint NOT NULL,
    storage_key    varchar(200) NOT NULL,
    original_name  varchar(255) NOT NULL,
    size_bytes     bigint NOT NULL,
    created_at     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_post_attachment_post FOREIGN KEY (post_id) REFERENCES post (id) ON DELETE CASCADE,
    CONSTRAINT uq_post_attachment_key UNIQUE (storage_key),
    CONSTRAINT ck_post_attachment_name CHECK (char_length(original_name) BETWEEN 1 AND 255),
    CONSTRAINT ck_post_attachment_size CHECK (size_bytes BETWEEN 1 AND 10485760)
);

CREATE INDEX ix_post_attachment_post ON post_attachment (post_id, id);

-- 지울 파일 목록. 첨부 행이 어떤 경로로 지워지든(직접 삭제, 글 완전 삭제·빈 임시글 정리의 CASCADE) 트리거가 키를 남기고,
-- 정리 작업이 저장소에서 지운 뒤 이 행을 지운다 (FR-012)
CREATE TABLE attachment_trash (
    storage_key  varchar(200) NOT NULL,
    queued_at    timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (storage_key)
);

CREATE FUNCTION queue_attachment_file() RETURNS trigger
    LANGUAGE plpgsql AS
$$
BEGIN
    INSERT INTO attachment_trash (storage_key) VALUES (OLD.storage_key) ON CONFLICT DO NOTHING;
    RETURN OLD;
END;
$$;

CREATE TRIGGER tr_post_attachment_deleted
    AFTER DELETE ON post_attachment
    FOR EACH ROW EXECUTE FUNCTION queue_attachment_file();
