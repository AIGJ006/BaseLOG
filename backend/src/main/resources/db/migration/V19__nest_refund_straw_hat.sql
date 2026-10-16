-- 021 둥지: 새 장식 밀짚모자를 상품에서 뺀다(2026-10-16 민서). 샀던 사람에게 쓴 포인트를 돌려준다(V11·V16과 같은 방식).
-- source_key가 'REFUND:<물건>'이라 다시 돌아도 두 번 들어가지 않는다. 산 기록(nest_item)·장착 목록은 그대로 둔다 — 앱이 모르는 코드는
-- 보이지 않는다. 데이터만 더하므로 무중단 배포에 문제없다(전환 중 늦은 구매가 있으면 다음 배포에 같은 SQL을 한 번 더 넣는다).
INSERT INTO nest_point (member_id, reason, amount, source_key, earned_on)
SELECT member_id, 'ADJUST', -amount, 'REFUND:' || substring(source_key FROM 5),
       (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
FROM nest_point
WHERE reason = 'PURCHASE'
  AND source_key LIKE 'BUY:%'
  AND amount < 0
  AND substring(source_key FROM 5) = 'acc-straw-hat'
ON CONFLICT (member_id, source_key) DO NOTHING;
