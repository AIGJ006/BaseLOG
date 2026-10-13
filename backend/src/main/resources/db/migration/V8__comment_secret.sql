-- 007 비밀 댓글·비밀 답글 (2026-10-13 민서 "비밀댓글이랑 대댓글에도 비밀대댓글 기능 넣어줘").
-- 컬럼 추가만 한다(무중단 배포 — 옛 앱은 이 컬럼을 모른 채 INSERT해도 기본값 false로 들어간다). 기존 댓글은 모두 공개 댓글로 남는다.
ALTER TABLE comment ADD COLUMN secret boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN comment.secret IS '비밀 댓글 여부';
