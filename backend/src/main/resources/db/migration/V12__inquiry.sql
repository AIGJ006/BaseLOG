-- 023 문의·신고 (2026-10-14 민서 요청). 회원이 버그·계정 문의·사용자 신고·기타를 보내고, 관리자가 답하면 🔔로 알린다.
-- 새 테이블 하나를 더하고, 알림 종류 CHECK에 'INQUIRY_ANSWERED' 하나를 더한다(V6과 같은 방식 — 지우고 다시 만든다).
-- 옛 앱은 inquiry 테이블을 모르고 새 알림 종류를 만들지 않으므로 무중단 배포에 문제없다.

-- 문의 한 건. 답하면 status = 'ANSWERED'이고 answer·answered_at이 함께 찬다. 사진은 media의 글 사진 한 장(지워지면 NULL).
-- target_handle은 사용자 신고일 때만, 신고할 사람 블로그 주소(@ 뺀 소문자).
CREATE TABLE inquiry (
    id             bigint GENERATED ALWAYS AS IDENTITY,
    member_id      bigint NOT NULL,
    category       varchar(20) NOT NULL,
    content        text NOT NULL,
    target_handle  varchar(39) NULL,
    image_id       bigint NULL,
    status         varchar(20) NOT NULL DEFAULT 'RECEIVED',
    answer         text NULL,
    answered_by    bigint NULL,
    answered_at    timestamptz NULL,
    created_at     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_inquiry_member FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE,
    CONSTRAINT fk_inquiry_image FOREIGN KEY (image_id) REFERENCES image (id) ON DELETE SET NULL,
    CONSTRAINT fk_inquiry_answered_by FOREIGN KEY (answered_by) REFERENCES member (id) ON DELETE SET NULL,
    CONSTRAINT ck_inquiry_category CHECK (category IN ('BUG', 'ACCOUNT', 'USER_REPORT', 'OTHER')),
    CONSTRAINT ck_inquiry_status CHECK (status IN ('RECEIVED', 'ANSWERED')),
    CONSTRAINT ck_inquiry_answer CHECK ((status = 'ANSWERED') = (answer IS NOT NULL AND answered_at IS NOT NULL)),
    CONSTRAINT ck_inquiry_target CHECK (target_handle IS NULL OR category = 'USER_REPORT')
);

-- 내가 보낸 문의(새것부터)
CREATE INDEX ix_inquiry_member ON inquiry (member_id, id DESC);

-- 관리자 목록(상태별, 새것부터)
CREATE INDEX ix_inquiry_status ON inquiry (status, id DESC);

COMMENT ON TABLE inquiry IS '문의·신고';
COMMENT ON COLUMN inquiry.category IS '종류(버그 신고·계정 문의·사용자 신고·기타)';
COMMENT ON COLUMN inquiry.target_handle IS '신고할 사람 블로그 주소(사용자 신고만)';
COMMENT ON COLUMN inquiry.image_id IS '붙인 사진 번호';
COMMENT ON COLUMN inquiry.status IS '상태(접수·답변 완료)';
COMMENT ON COLUMN inquiry.answer IS '관리자 답변';
COMMENT ON COLUMN inquiry.answered_by IS '답한 관리자 회원 번호';
COMMENT ON COLUMN inquiry.answered_at IS '답한 일자';

-- 문의 답변 알림(운영 알림 — 끌 수 없다). 끌 수 있는 종류(ck_notification_mute_type)는 그대로다.
ALTER TABLE notification DROP CONSTRAINT ck_notification_type;
ALTER TABLE notification ADD CONSTRAINT ck_notification_type CHECK (type IN ('COMMENT', 'REPLY', 'LIKE', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_POST', 'REPORT_RESOLVED', 'CONTENT_HIDDEN', 'INQUIRY_ANSWERED')) NOT VALID;
ALTER TABLE notification VALIDATE CONSTRAINT ck_notification_type;
