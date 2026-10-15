-- 024 관리자 통계 (2026-10-14 민서 요청). 하루 방문자 수를 남길 새 테이블 하나만 더한다(무중단 배포 — 옛 앱은 이 테이블을 모른 채 그대로 돈다).
-- 누가 왔는지는 담지 않는다. 그날 방문자는 Redis HyperLogLog(stats:visit:{yyyyMMdd})로 세고, 5분마다 그 수만 여기 옮긴다.

-- 하루 한 줄: 서비스 시간대(Asia/Seoul) 날짜별 방문자 수와 그중 로그인 회원 수. 값은 줄어들지 않는다(옮길 때 큰 값을 남긴다).
CREATE TABLE site_visit_daily (
    visit_date       date NOT NULL,
    visitors         integer NOT NULL,
    member_visitors  integer NOT NULL,
    updated_at       timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (visit_date),
    CONSTRAINT ck_site_visit_daily_counts CHECK (visitors >= 0 AND member_visitors >= 0)
);

COMMENT ON TABLE site_visit_daily IS '일별 방문자 수';
COMMENT ON COLUMN site_visit_daily.visit_date IS '방문 일자';
COMMENT ON COLUMN site_visit_daily.visitors IS '방문자 수(회원·비회원)';
COMMENT ON COLUMN site_visit_daily.member_visitors IS '그중 로그인 회원 수';
