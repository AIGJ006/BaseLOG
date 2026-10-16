-- 021 둥지: V19(밀짚모자 환불)를 한 번 더 돈다(2026-10-16). 1.4.3 무중단 배포 때 V19가 돈 뒤에도 옛 앱(1.4.2)이 몇십 초
-- 밀짚모자를 팔 수 있어서, 그 사이 산 것은 V19에서 빠질 수 있다. 이번 배포의 옛 앱(1.4.3 이상)은 밀짚모자를 팔지 않으므로
-- 여기서 남은 구매가 모두 잡힌다. 'REFUND:<물건>' source_key가 같아 이미 돌려준 것은 다시 들어가지 않는다.
INSERT INTO nest_point (member_id, reason, amount, source_key, earned_on)
SELECT member_id, 'ADJUST', -amount, 'REFUND:' || substring(source_key FROM 5),
       (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Seoul')::date
FROM nest_point
WHERE reason = 'PURCHASE'
  AND source_key LIKE 'BUY:%'
  AND amount < 0
  AND substring(source_key FROM 5) = 'acc-straw-hat'
ON CONFLICT (member_id, source_key) DO NOTHING;
