-- 025 둥지 배너 (2026-10-15 민서 요청). 둥지 머리말 위에 넓은 배너 사진 한 장을 둔다.
-- 프로필 사진과 같은 방식이다: member에 칸을 두지 않고, image 행의 용도(purpose = 'BANNER')와 연결 상태로 "지금 배너"를 정한다.
-- 사진 용도 CHECK에 'BANNER' 하나를 더하고(V6·V12와 같은 방식 — 지우고 다시 만든다), 회원당 지금 배너 한 장을 막는 부분 유일 인덱스를 더한다.
-- 옛 앱은 배너 사진을 만들지 않고, 정리 작업·탈퇴 정리는 용도를 보지 않으므로 무중단 배포에 문제없다.

ALTER TABLE image DROP CONSTRAINT ck_image_purpose;
ALTER TABLE image ADD CONSTRAINT ck_image_purpose CHECK (purpose IN ('POST', 'PROFILE', 'BANNER')) NOT VALID;
ALTER TABLE image VALIDATE CONSTRAINT ck_image_purpose;

-- 지금 배너(회원당 최대 1장). 조건은 uq_image_profile_current와 같다.
CREATE UNIQUE INDEX uq_image_banner_current ON image (uploader_id) WHERE purpose = 'BANNER' AND status = 'ATTACHED' AND detached_at IS NULL;
