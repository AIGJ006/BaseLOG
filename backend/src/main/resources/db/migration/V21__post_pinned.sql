-- 028 고정 글: 글쓴이가 자기 글을 둥지 글 목록 맨 위에 고정한다(2026-10-16 민서). 한 둥지에 최대 3개, 최근 고정한 순.
-- 칸과 인덱스만 더한다(값 없음 = 고정 안 함). 옛 앱은 이 칸을 모르고 지나가 무중단 배포에 문제없다.
ALTER TABLE post ADD COLUMN pinned_at timestamptz NULL;

CREATE INDEX ix_post_pinned ON post (author_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;

COMMENT ON COLUMN post.pinned_at IS '고정한 시각 (없으면 고정 안 함, 휴지통으로 옮기면 지움)';
