-- 020 팔로우 → 친구 (2026-10-12 민서 요청 "팔로우를 빼고 친구로 바꿔줘").
-- follow 테이블과 그 행은 되돌리기 쉽게 그대로 둔다(코드가 더는 읽거나 쓰지 않는다. 탈퇴 정리만 계속 지운다).
-- 알림: 새 팔로워(FOLLOW) 알림과 그 끄기 설정을 지우고, 친구 요청(FRIEND_REQUEST)·친구 수락(FRIEND_ACCEPTED)을 더한다.
-- 두 종류는 묶지 않는 한 건짜리 알림이라 group_key가 없다(묶음은 이제 LIKE만).
DELETE FROM notification WHERE type = 'FOLLOW';
DELETE FROM notification_mute WHERE type = 'FOLLOW';

ALTER TABLE notification DROP CONSTRAINT ck_notification_type;
ALTER TABLE notification ADD CONSTRAINT ck_notification_type CHECK (type IN ('COMMENT', 'REPLY', 'LIKE', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_POST', 'REPORT_RESOLVED', 'CONTENT_HIDDEN'));

ALTER TABLE notification DROP CONSTRAINT ck_notification_group;
ALTER TABLE notification ADD CONSTRAINT ck_notification_group CHECK ((type = 'LIKE') = (group_key IS NOT NULL));

ALTER TABLE notification_mute DROP CONSTRAINT ck_notification_mute_type;
ALTER TABLE notification_mute ADD CONSTRAINT ck_notification_mute_type CHECK (type IN ('COMMENT', 'REPLY', 'LIKE', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_POST'));
