import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  attendNest,
  buyNestItem,
  equipNest,
  giveNestPointsForTesting,
  listNestPoints,
  setNestLevelForTesting,
  type MyNest,
  type NestItemKind,
  type PointEntry,
  type ShopItem,
} from '../api/nest';
import RelativeTime from '../components/RelativeTime';
import { useToast } from '../components/useToast';
import { loginPathFor } from '../features/auth-gate/authGate';
import { useSession } from '../features/auth/useSession';
import NestScene from '../features/nest/NestScene';
import { artUrl } from '../features/nest/nestArt';
import {
  attendanceToast,
  KIND_TABS,
  NEST_PAGE_TITLE,
  REASON_TEXT,
} from '../features/nest/nestMessages';
import '../features/nest/nest.css';

const LOAD_FAILED_TEXT = '둥지를 불러오지 못했어요';

/**
 * 새 키우기 `/nest` (021 US1·US2). 계정 메뉴의 [새 키우기]로 연다. 들어오면 오늘 출석을 기록한다(하루 한 번 +10).
 * 위쪽은 둥지 그림·포인트·새 크기·연속 출석·오늘 받은 포인트, 아래는 꾸미기(배경·둥지·새 장식 탭)와 포인트 기록이다.
 * 상점은 따로 없다(2026-10-13 민서) — 잠긴 물건의 [N점으로 해금]을 누르면 포인트를 쓰고 바로 씌운다.
 * 배경·둥지는 하나, 새 장식은 여러 개(새 장식은 머리 칸에 하나).
 *
 * 로그인 전용: 비로그인이면 `/login?returnTo=…`로 보낸다(서버도 401).
 */
export default function NestPage() {
  const { loading, me } = useSession();
  const location = useLocation();
  if (loading) {
    return <main data-route="nest" aria-busy="true" className="nest-page" />;
  }
  if (!me) {
    return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  }
  return <NestManager />;
}

function NestManager() {
  const [nest, setNest] = useState<MyNest | null>(null);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<NestItemKind>('BACKGROUND');
  const [history, setHistory] = useState<{ items: PointEntry[]; nextBefore: number | null }>({
    items: [],
    nextBefore: null,
  });
  // 포인트 기록은 처음 5개만, [더 보기]마다 10개씩 더 (2026-10-14 민서)
  const [shownHistory, setShownHistory] = useState(HISTORY_FIRST);
  const { show, toast } = useToast();
  const title = NEST_PAGE_TITLE;

  const reloadHistory = useCallback(async () => {
    try {
      const page = await listNestPoints();
      setHistory(page);
    } catch {
      // 기록을 못 불러와도 꾸미기는 그대로
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await attendNest();
        if (cancelled) {
          return;
        }
        setNest(result.me);
        const message = attendanceToast(result);
        if (message) {
          show(message);
        }
        await reloadHistory();
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [show, reloadHistory]);

  const run = async (work: () => Promise<MyNest>, done?: string) => {
    setBusy(true);
    setError(null);
    try {
      setNest(await work());
      if (done) {
        show({ text: done });
      }
      await reloadHistory();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '잠시 후 다시 시도해 주세요');
    } finally {
      setBusy(false);
    }
  };

  if (failed) {
    return (
      <main data-route="nest" className="nest-page">
        <h1>{title}</h1>
        <p role="status">{LOAD_FAILED_TEXT}</p>
      </main>
    );
  }
  if (nest === null) {
    return <main data-route="nest" aria-busy="true" className="nest-page" />;
  }

  const look = nest.nest;

  /** 해금: 포인트를 쓰고 바로 씌운다 */
  const unlock = (item: ShopItem) =>
    run(async () => {
      const after = await buyNestItem(item.code);
      return equipNest(equipped(after, item, true));
    }, `'${item.name}' 해금했어요`);

  const equip = (item: ShopItem, on: boolean) => run(() => equipNest(equipped(nest, item, on)));

  const loadMore = async () => {
    const want = shownHistory + HISTORY_MORE;
    setShownHistory(want);
    if (want <= history.items.length || history.nextBefore === null) {
      return;
    }
    try {
      const page = await listNestPoints(history.nextBefore);
      setHistory((current) => ({
        items: [...current.items, ...page.items],
        nextBefore: page.nextBefore,
      }));
    } catch {
      // 다음 쪽을 못 불러오면 버튼을 그대로 둔다
    }
  };

  return (
    <main data-route="nest" className="nest-page">
      <h1>{title}</h1>
      {error ? (
        <p role="alert" className="nest-error">
          {error}
        </p>
      ) : null}

      <div className="nest-page__top">
        <NestScene look={look} width={280} />
        <div className="nest-card">
          <dl className="nest-stats">
            <div className="nest-stat">
              <dt>포인트</dt>
              <dd data-testid="nest-balance">{nest.balance.toLocaleString('ko-KR')}점</dd>
            </div>
            <div className="nest-stat">
              <dt>새 크기</dt>
              <dd>
                {look.levelName} <small>{look.level}/4</small>
              </dd>
            </div>
            <div className="nest-stat">
              <dt>연속 출석</dt>
              <dd>
                {look.streakDays}일 <small>최고 {nest.bestStreakDays}일</small>
              </dd>
            </div>
            <div className="nest-stat">
              <dt>다음 성장</dt>
              <dd>{nest.daysToGrow === 0 ? '다 자랐어요' : `${nest.daysToGrow}일 더 출석`}</dd>
            </div>
          </dl>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.875rem' }} data-testid="nest-today">
            오늘 받은 포인트:{' '}
            {nest.today
              .map((e) => `${REASON_TEXT[e.reason] ?? e.reason} ${e.count}/${e.cap}`)
              .join(' · ')}
          </p>
          <ul className="nest-rules">
            <li>하루 한 번 둥지에 들어오면 출석 +10점, 7일 연속마다 +30점</li>
            <li>
              글 등록 +20점(하루 3번), 댓글 +5점(하루 5번), 다른 사람이 누른 좋아요 +2점(하루 20번)
            </li>
            <li>
              3일 연속 출석할 때마다 새가 한 단계 자라요. 3일 넘게 안 오면 하루 한 단계씩 작아져요
            </li>
          </ul>
        </div>
      </div>

      <section aria-labelledby="nest-decorate-title">
        <h2 id="nest-decorate-title">꾸미기</h2>
        <div className="nest-tabs" role="tablist" aria-label="물건 종류">
          {KIND_TABS.map((tab) => (
            <button
              key={tab.kind}
              type="button"
              role="tab"
              aria-selected={tab.kind === kind}
              onClick={() => setKind(tab.kind)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ul className="nest-shop">
          {nest.items
            .filter((item) => item.kind === kind)
            .map((item) => (
              <li
                key={item.code}
                className="nest-shop__item"
                data-equipped={item.equipped}
                data-locked={!item.owned}
                data-testid={`nest-item-${item.code}`}
              >
                {isDecoration(item) ? (
                  <ItemPicture code={item.code} />
                ) : (
                  <NestScene look={preview(look, item)} width="100%" />
                )}
                <p className="nest-shop__name">{item.name}</p>
                <ItemButton
                  item={item}
                  balance={nest.balance}
                  busy={busy}
                  onUnlock={() => void unlock(item)}
                  onEquip={(on) => void equip(item, on)}
                />
              </li>
            ))}
        </ul>
      </section>

      {nest.devTools ? (
        <DevTools
          level={look.level}
          busy={busy}
          onLevel={(level) =>
            void run(() => setNestLevelForTesting(level), `${level}단계로 바꿨어요`)
          }
          onPoints={(amount) =>
            void run(
              () => giveNestPointsForTesting(amount),
              `${amount.toLocaleString('ko-KR')}점 넣었어요`,
            )
          }
        />
      ) : null}

      <section aria-labelledby="nest-history-title">
        <h2 id="nest-history-title">포인트 기록</h2>
        {history.items.length === 0 ? (
          <p>아직 기록이 없어요</p>
        ) : (
          <ul className="nest-history">
            {history.items.slice(0, shownHistory).map((entry) => (
              <li key={entry.id}>
                <span>
                  {entry.label}{' '}
                  <RelativeTime value={entry.createdAt} className="nest-history__when" />
                </span>
                <span className={entry.amount > 0 ? 'nest-history__plus' : 'nest-history__minus'}>
                  {entry.amount > 0 ? '+' : ''}
                  {entry.amount.toLocaleString('ko-KR')}
                </span>
              </li>
            ))}
          </ul>
        )}
        {history.items.length > shownHistory || history.nextBefore !== null ? (
          <p style={{ textAlign: 'center' }}>
            <button type="button" onClick={() => void loadMore()}>
              더 보기
            </button>
          </p>
        ) : null}
      </section>
      {toast}
    </main>
  );
}

const HISTORY_FIRST = 5;
const HISTORY_MORE = 10;

/** 여러 개 다는 물건(새 장식)인가 — 배경·둥지는 하나만 */
function isDecoration(item: ShopItem): boolean {
  return item.kind === 'ACCESSORY';
}

/** 그 물건을 달거나(on) 내린 뒤의 장착 요청. 새 장식은 칸마다 하나 — 같은 칸에 있던 것은 내리고 바꿔 단다 */
function equipped(current: MyNest, item: ShopItem, on: boolean) {
  const look = current.nest;
  const sameSlot = new Set(
    current.items
      .filter((other) => item.slot !== null && other.slot === item.slot)
      .map((other) => other.code),
  );
  const decorations = !isDecoration(item)
    ? look.decorations
    : on
      ? [...look.decorations.filter((code) => !sameSlot.has(code)), item.code]
      : look.decorations.filter((code) => code !== item.code);
  return {
    background: item.kind === 'BACKGROUND' ? item.code : look.background,
    nestType: item.kind === 'NEST' ? item.code : look.nestType,
    decorations,
  };
}

/** 배경·둥지를 지금 둥지에 바꿔 놓아 본 모습 */
function preview(look: MyNest['nest'], item: ShopItem): MyNest['nest'] {
  return item.kind === 'BACKGROUND'
    ? { ...look, background: item.code }
    : { ...look, nestType: item.code };
}

/** 새 장식은 그림만 크게 */
function ItemPicture({ code }: { code: string }) {
  return (
    <div className="nest-shop__picture">
      <img src={artUrl(code)} alt="" />
    </div>
  );
}

function ItemButton({
  item,
  balance,
  busy,
  onUnlock,
  onEquip,
}: {
  item: ShopItem;
  balance: number;
  busy: boolean;
  onUnlock: () => void;
  onEquip: (on: boolean) => void;
}) {
  if (!item.owned) {
    const short = balance < item.price;
    return (
      <button type="button" className="nest-buy" disabled={busy || short} onClick={onUnlock}>
        {short
          ? `🔒 ${(item.price - balance).toLocaleString('ko-KR')}점 모자라요`
          : `🔒 ${item.price.toLocaleString('ko-KR')}점으로 해금`}
      </button>
    );
  }
  if (item.equipped) {
    return isDecoration(item) ? (
      <button type="button" className="nest-fill" disabled={busy} onClick={() => onEquip(false)}>
        착용 해제
      </button>
    ) : (
      <button type="button" disabled>
        적용 중
      </button>
    );
  }
  return (
    <button type="button" disabled={busy} onClick={() => onEquip(true)}>
      {isDecoration(item) ? '착용' : '적용'}
    </button>
  );
}

/** 시험용 칸 — 로컬 서버(`blog.nest.dev-tools`)에서만 보인다 */
function DevTools({
  level,
  busy,
  onLevel,
  onPoints,
}: {
  level: number;
  busy: boolean;
  onLevel: (level: number) => void;
  onPoints: (amount: number) => void;
}) {
  return (
    <section aria-labelledby="nest-dev-title" className="nest-dev" data-testid="nest-dev">
      <h2 id="nest-dev-title">시험용 (로컬에서만 보여요)</h2>
      <div className="nest-dev__row">
        <span>새 단계</span>
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={n === level}
            disabled={busy}
            onClick={() => onLevel(n)}
          >
            {n}단계
          </button>
        ))}
      </div>
      <div className="nest-dev__row">
        <span>포인트</span>
        {[100, 1000].map((amount) => (
          <button key={amount} type="button" disabled={busy} onClick={() => onPoints(amount)}>
            +{amount.toLocaleString('ko-KR')}점
          </button>
        ))}
      </div>
    </section>
  );
}
