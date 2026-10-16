-- 021 둥지: 배경을 사계절 그림 넷(봄·여름·가을·겨울)으로 바꾸면서(2026-10-16 민서) 팔던 배경 다섯 개(풀밭·맑은 하늘·노을·벚꽃·밤하늘)를
-- 샀던 사람에게 쓴 포인트를 돌려준다(V11과 같은 방식). source_key가 'REFUND:<물건>'이라 다시 돌아도 두 번 들어가지 않는다.
-- 산 기록(nest_item)·nest.background는 그대로 둔다 — 앱이 모르는 코드는 기본 배경으로 본다. 데이터만 더하므로 무중단 배포에 문제없다.
INSERT INTO nest_point (member_id, reason, amount, source_key, earned_on)
SELECT member_id, 'ADJUST', -amount, 'REFUND:' || substring(source_key FROM 5),
       (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
FROM nest_point
WHERE reason = 'PURCHASE'
  AND source_key LIKE 'BUY:%'
  AND amount < 0
  AND substring(source_key FROM 5) IN ('bg-meadow', 'bg-sky', 'bg-sunset', 'bg-cherry', 'bg-night')
ON CONFLICT (member_id, source_key) DO NOTHING;
