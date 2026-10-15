-- 025 둥지 배너 색 (2026-10-15 민서 요청 "배너 색상 바꿀 수 있게"). 배너 사진이 없을 때 칠할 색을 회원이 고른다.
-- 칸 하나 추가(null = 기본 배경)라 옛 앱은 이 칸을 모르고 지나가므로 무중단 배포에 문제없다.
-- 값은 소문자 #rrggbb만 받는다.

ALTER TABLE member ADD COLUMN banner_color VARCHAR(7);
-- 방금 만든 칸이라 기존 행은 모두 null이다. 그래서 기존 행 검사(VALIDATE)는 할 것이 없어 NOT VALID로만 걸고,
-- 새로 쓰는 값만 검사한다(같은 트랜잭션에서 VALIDATE하면 검사 동안 잠금이 길어진다).
ALTER TABLE member ADD CONSTRAINT ck_member_banner_color CHECK (banner_color ~ '^#[0-9a-f]{6}$') NOT VALID;
