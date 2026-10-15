-- 025 둥지 배너 색 (2026-10-15 민서 요청 "배너 색상 바꿀 수 있게"). 배너 사진이 없을 때 칠할 색을 회원이 고른다.
-- 칸 하나 추가(null = 기본 배경)라 옛 앱은 이 칸을 모르고 지나가므로 무중단 배포에 문제없다.
-- 값은 소문자 #rrggbb만 받는다.

ALTER TABLE member ADD COLUMN banner_color VARCHAR(7);
-- CHECK는 V14처럼 NOT VALID로 걸고 따로 검사한다(검사 중 회원 쓰기를 막지 않게).
ALTER TABLE member ADD CONSTRAINT ck_member_banner_color CHECK (banner_color ~ '^#[0-9a-f]{6}$') NOT VALID;
ALTER TABLE member VALIDATE CONSTRAINT ck_member_banner_color;
