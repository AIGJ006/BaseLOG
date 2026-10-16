-- 030 공동 작업자: V22에서 NOT VALID로 넓힌 알림 종류 제약을 따로 검증한다(검증은 읽기·쓰기를 막지 않는 잠금으로 돈다).
ALTER TABLE notification VALIDATE CONSTRAINT ck_notification_type;
