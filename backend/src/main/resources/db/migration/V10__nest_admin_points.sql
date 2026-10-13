-- 021 둥지: 관리자 계정에 꾸미기 물건을 모두 해금할 만큼의 포인트를 한 번 준다(2026-10-13 민서 요청).
-- 3040점 = 지금 파는 물건 값의 합(배경 800 + 둥지 1000 + 소품 500 + 새 장식 740). 기록 한 줄(ADJUST)만 더하고,
-- 같은 source_key라 다시 돌아도 두 번 들어가지 않는다. 데이터만 더하므로 무중단 배포에 문제없다.
INSERT INTO nest_point (member_id, reason, amount, source_key, earned_on)
SELECT id, 'ADJUST', 3040, 'admin-grant:2026-10-13', (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
FROM member
WHERE role = 'ADMIN'
ON CONFLICT (member_id, source_key) DO NOTHING;
