-- 029 고정 글: 글쓴이가 자기 글을 둥지 글 목록 맨 위에 고정한다(2026-10-16 민서). 한 둥지에 최대 3개, 최근 고정한 순.
-- 기본값 없는 NULL 칸 하나만 더한다(값 없음 = 고정 안 함) — 표를 다시 쓰지 않아 잠금이 짧고, 옛 앱은 이 칸을 모르고 지나가 무중단 배포에 문제없다.
-- 인덱스는 두지 않는다: 고정 글 조회는 한 회원의 글만 보므로 기존 ix_post_blog(author_id …)로 충분하고, 배포 중 post 쓰기를 막지 않는다.
ALTER TABLE post ADD COLUMN pinned_at timestamptz NULL;

COMMENT ON COLUMN post.pinned_at IS '고정한 시각 (없으면 고정 안 함, 휴지통으로 옮기면 지움)';
