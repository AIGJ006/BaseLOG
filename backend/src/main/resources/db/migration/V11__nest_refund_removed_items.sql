-- 021 둥지: 꾸미기에서 뺀 물건을 샀던 사람에게 쓴 포인트를 돌려준다(2026-10-13 민서 — 소품 9종, 새 장식 하트·별·나비,
-- 앞서 뺀 새집·울타리·버섯 둥지와 안경·선글라스·모자·목도리·방울 목걸이까지). 지금 파는 물건 말고 산 기록(PURCHASE)마다
-- 반대 부호 한 줄(ADJUST)을 더한다. source_key가 'REFUND:<물건>'이라 다시 돌아도 두 번 들어가지 않는다.
-- 산 기록(nest_item)은 지우지 않는다 — 앱이 모르는 코드는 걸러 내고 보이지 않는다. 데이터만 더하므로 무중단 배포에 문제없다.
INSERT INTO nest_point (member_id, reason, amount, source_key, earned_on)
SELECT member_id, 'ADJUST', -amount, 'REFUND:' || substring(source_key FROM 5),
       (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
FROM nest_point
WHERE reason = 'PURCHASE'
  AND source_key LIKE 'BUY:%'
  AND amount < 0
  AND substring(source_key FROM 5) NOT IN (
      'bg-meadow', 'bg-sky', 'bg-sunset', 'bg-cherry', 'bg-night',
      'nest-leaf', 'nest-flower', 'nest-snow', 'nest-ribbon', 'nest-star',
      'acc-flower-crown', 'acc-ribbon', 'acc-crown', 'acc-flower-pin')
ON CONFLICT (member_id, source_key) DO NOTHING;
