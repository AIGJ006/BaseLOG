-- 020 팔로우 → 친구 (2026-10-12 민서 요청 "팔로우를 빼고 친구로 바꿔줘").
-- 기존 팔로우 기록은 지운다(2026-10-12 민서 승인 "db지워도 돼"). 행만 지우고 follow 테이블은 팀 ERD에 맞춰 둔다.
-- 친구로 자동으로 옮기지 않는다. 코드는 이제 follow를 읽거나 쓰지 않는다(탈퇴 정리의 DELETE만 남음).
-- 알림: 새 팔로워(FOLLOW) 알림과 그 끄기 설정을 지우고, 친구 요청(FRIEND_REQUEST)·친구 수락(FRIEND_ACCEPTED)을 더한다.
-- 두 종류는 묶지 않는 한 건짜리 알림이라 group_key가 없다(묶음은 이제 LIKE만).
DELETE FROM follow;

DELETE FROM notification WHERE type = 'FOLLOW';
DELETE FROM notification_mute WHERE type = 'FOLLOW';

ALTER TABLE notification DROP CONSTRAINT ck_notification_type;
ALTER TABLE notification ADD CONSTRAINT ck_notification_type CHECK (type IN ('COMMENT', 'REPLY', 'LIKE', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_POST', 'REPORT_RESOLVED', 'CONTENT_HIDDEN'));

ALTER TABLE notification DROP CONSTRAINT ck_notification_group;
ALTER TABLE notification ADD CONSTRAINT ck_notification_group CHECK ((type = 'LIKE') = (group_key IS NOT NULL));

ALTER TABLE notification_mute DROP CONSTRAINT ck_notification_mute_type;
ALTER TABLE notification_mute ADD CONSTRAINT ck_notification_mute_type CHECK (type IN ('COMMENT', 'REPLY', 'LIKE', 'FRIEND_REQUEST', 'FRIEND_ACCEPTED', 'NEW_POST'));
