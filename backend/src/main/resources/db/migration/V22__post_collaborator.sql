-- 030 공동 작업자 (2026-10-16 민서 "ㄱㄱ"). 새 테이블만 더하고 알림 종류 제약을 넓힌다(무중단 배포 — 옛 앱은 이 테이블을 모른 채 그대로 돈다).
-- 글쓴이가 친구 중 최대 3명을 고른다(3명 제한은 앱이 지킨다). 공동 작업자는 그 글의 제목·본문만 고칠 수 있다.
-- 친구를 끊으면 앱이 행을 지우고, 권한 확인도 지금 친구인지 함께 본다.
CREATE TABLE post_collaborator (
    post_id     bigint NOT NULL,
    member_id   bigint NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, member_id),
    CONSTRAINT fk_post_collaborator_post FOREIGN KEY (post_id) REFERENCES post (id) ON DELETE CASCADE,
    CONSTRAINT fk_post_collaborator_member FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE
);

CREATE INDEX ix_post_collaborator_member ON post_collaborator (member_id);

-- 공동 작업자로 추가됨 알림(끌 수 없다). 끌 수 있는 종류(ck_notification_mute_type)는 그대로다.
ALTER TABLE notification DROP CONSTRAINT ck_notification_type;
ALTER TABLE notification ADD CONSTRAINT ck_notification_type CHECK (type IN ('COMMENT', 'REPLY', 'LIKE', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_POST', 'REPORT_RESOLVED', 'CONTENT_HIDDEN', 'INQUIRY_ANSWERED', 'COLLABORATOR_ADDED')) NOT VALID;
ALTER TABLE notification VALIDATE CONSTRAINT ck_notification_type;
