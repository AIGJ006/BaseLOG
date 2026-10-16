-- 021 둥지: 내 둥지(블로그) 프로필에 내 새를 보일지(2026-10-16 민서). 처음엔 꺼져 있고 설정 > 프로필에서 켠다.
-- 칸만 더하고 기본값이 있어 옛 앱은 모르고 지나간다 — 무중단 배포에 문제없다.
ALTER TABLE nest ADD COLUMN show_on_blog boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN nest.show_on_blog IS '내 둥지 프로필에 새를 보이나 (기본 꺼짐)';
