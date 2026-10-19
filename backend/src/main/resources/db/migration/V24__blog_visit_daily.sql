-- 031 둥지별 방문자 (2026-10-19 민서 "둥지별 통계 구현해줘"). 새 테이블 하나만 더한다(무중단 배포 — 옛 앱은 이 테이블을 모른 채 그대로 돈다).
-- 누가 왔는지는 담지 않는다. 둥지마다 그날 방문자를 Redis HyperLogLog(stats:nest-visit:{yyyyMMdd}:{주인 번호})로 세고, 5분마다 그 수만 여기 옮긴다.
-- 둥지 주인 본인·관리자·봇은 세지 않는다(앱이 뺀다).

-- 둥지 하나의 하루 한 줄: 서비스 시간대(Asia/Seoul) 날짜별 방문자 수. 값은 줄어들지 않는다(옮길 때 큰 값을 남긴다).
CREATE TABLE blog_visit_daily (
    owner_id    bigint NOT NULL,
    visit_date  date NOT NULL,
    visitors    integer NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (owner_id, visit_date),
    CONSTRAINT fk_blog_visit_daily_owner FOREIGN KEY (owner_id) REFERENCES member (id) ON DELETE CASCADE,
    CONSTRAINT ck_blog_visit_daily_visitors CHECK (visitors >= 0)
);

COMMENT ON TABLE blog_visit_daily IS '둥지별 일별 방문자 수';
COMMENT ON COLUMN blog_visit_daily.owner_id IS '둥지 주인 회원 번호';
COMMENT ON COLUMN blog_visit_daily.visit_date IS '방문 일자';
COMMENT ON COLUMN blog_visit_daily.visitors IS '방문자 수(회원·비회원, 주인 본인 제외)';
