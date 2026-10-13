-- 021 둥지 꾸미기·새 키우기 (2026-10-13 민서 "해줘"). 새 테이블만 더한다(무중단 배포 — 옛 앱은 이 테이블을 모른 채 그대로 돈다).
-- 포인트는 잔액 칸을 두지 않고 "언제·왜·몇 점" 기록(nest_point)의 합으로 센다. 같은 까닭으로 두 번 받지 않게 (회원, source_key)가 유일하다.

-- 회원당 둥지 한 줄: 새 크기(1~5)·연속 출석·장착한 배경과 테두리. 처음 출석하거나 포인트를 받을 때 생긴다.
CREATE TABLE nest (
    member_id         bigint NOT NULL,
    bird_level        smallint NOT NULL DEFAULT 1,
    streak_days       integer NOT NULL DEFAULT 0,
    best_streak_days  integer NOT NULL DEFAULT 0,
    last_attended_on  date NULL,
    background        varchar(30) NOT NULL DEFAULT 'bg-basic',
    border            varchar(30) NOT NULL DEFAULT 'border-none',
    created_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id),
    CONSTRAINT fk_nest_member FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE,
    CONSTRAINT ck_nest_level CHECK (bird_level BETWEEN 1 AND 5),
    CONSTRAINT ck_nest_streak CHECK (streak_days >= 0 AND best_streak_days >= streak_days)
);

-- 포인트 기록. 쓰면(PURCHASE) 음수, 되돌리면(ADJUST) 반대 부호 한 줄을 더한다. earned_on은 서비스 시간대(Asia/Seoul) 날짜 — 하루 상한을 센다.
CREATE TABLE nest_point (
    id          bigint GENERATED ALWAYS AS IDENTITY,
    member_id   bigint NOT NULL,
    reason      varchar(20) NOT NULL,
    amount      integer NOT NULL,
    source_key  varchar(80) NOT NULL,
    earned_on   date NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT fk_nest_point_member FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE,
    CONSTRAINT uq_nest_point_source UNIQUE (member_id, source_key),
    CONSTRAINT ck_nest_point_reason CHECK (reason IN ('ATTENDANCE', 'STREAK_BONUS', 'POST', 'COMMENT', 'LIKE_RECEIVED', 'PURCHASE', 'ADJUST')),
    CONSTRAINT ck_nest_point_amount CHECK (amount <> 0)
);

CREATE INDEX ix_nest_point_member ON nest_point (member_id, id DESC);

CREATE INDEX ix_nest_point_day ON nest_point (member_id, reason, earned_on);

-- 산 꾸미기 물건. 값이 0인 기본 물건은 사지 않아도 가진 것으로 보고 여기 두지 않는다. 장식(DECORATION)의 장착 여부는 equipped,
-- 배경·테두리의 장착은 nest.background·nest.border.
CREATE TABLE nest_item (
    member_id  bigint NOT NULL,
    item_code  varchar(30) NOT NULL,
    equipped   boolean NOT NULL DEFAULT false,
    bought_at  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (member_id, item_code),
    CONSTRAINT fk_nest_item_member FOREIGN KEY (member_id) REFERENCES member (id) ON DELETE CASCADE
);

COMMENT ON TABLE nest IS '둥지(새 크기·연속 출석·장착한 배경과 테두리)';
COMMENT ON TABLE nest_point IS '둥지 포인트 기록(합이 잔액)';
COMMENT ON TABLE nest_item IS '산 둥지 꾸미기 물건';
