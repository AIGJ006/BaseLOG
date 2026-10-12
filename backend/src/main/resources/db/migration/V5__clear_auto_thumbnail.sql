-- 019 글 썸네일 지정: post.thumbnail_url은 이제 작성자가 고른 값만 담는다.
-- 지금까지 본문 첫 사진으로 자동으로 채운 값은 "지정 없음"으로 본다(카드에는 둥지 B가 나온다).
UPDATE post SET thumbnail_url = NULL WHERE thumbnail_url IS NOT NULL;
