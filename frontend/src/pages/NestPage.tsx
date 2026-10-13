import { useCallback, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  attendNest,
  buyNestItem,
  equipNest,
  listNestPoints,
  type MyNest,
  type NestItemKind,
  type PointEntry,
  type ShopItem,
} from '../api/nest';
import RelativeTime from '../components/RelativeTime';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';
import { loginPathFor } from '../features/auth-gate/authGate';
import { useSession } from '../features/auth/useSession';
import NestScene from '../features/nest/NestScene';
import { artUrl } from '../features/nest/nestArt';
import { attendanceToast, KIND_TABS, REASON_TEXT } from '../features/nest/nestMessages';
import '../features/nest/nest.css';

const LOAD_FAILED_TEXT = '둥지를 불러오지 못했어요';

/**
 * 내 둥지 꾸미기 `/nest` (021 US1·US2). 계정 메뉴의 [내 둥지 꾸미기]로 연다. 들어오면 오늘 출석을 기록한다(하루 한 번 +10).
 * 위쪽은 둥지 그림·포인트·새 크기·연속 출석·오늘 받은 포인트, 아래는 상점(배경·둥지·새 장식·소품 탭)과 포인트 기록이다.
 * 사면 바로 장착하지 않는다 — [장착]을 따로 누른다. 배경·둥지는 하나, 소품·새 장식은 여러 개(새 장식은 머리·얼굴·목에 하나씩).
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
  const { show, toast } = useToast();
  const { confirm, dialog } = useConfirm();

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
        <h1>내 둥지 꾸미기</h1>
        <p role="status">{LOAD_FAILED_TEXT}</p>
      </main>
    );
  }
  if (nest === null) {
    return <main data-route="nest" aria-busy="true" className="nest-page" />;
  }

  const look = nest.nest;
  const equippedDecorations = look.decorations;

  const buy = async (item: ShopItem) => {
    const ok = await confirm({
      title: `'${item.name}' 사기`,
      message: `${item.price.toLocaleString('ko-KR')}점을 써요. 산 물건은 되돌릴 수 없어요.`,
      confirmLabel: '사기',
    });
    if (ok) {
      await run(() => buyNestItem(item.code), `'${item.name}' 샀어요`);
    }
  };

  const equip = (item: ShopItem, on: boolean) => {
    // 새 장식은 머리·얼굴·목 칸마다 하나 — 같은 칸에 있던 것은 내리고 바꿔 단다
    const sameSlot = new Set(
      nest.items
        .filter((other) => item.slot !== null && other.slot === item.slot)
        .map((other) => other.code),
    );
    const decorations = !isDecoration(item)
      ? equippedDecorations
      : on
        ? [...equippedDecorations.filter((code) => !sameSlot.has(code)), item.code]
        : equippedDecorations.filter((code) => code !== item.code);
    return run(() =>
      equipNest({
        background: item.kind === 'BACKGROUND' ? item.code : look.background,
        nestType: item.kind === 'NEST' ? item.code : look.nestType,
        decorations,
      }),
    );
  };

  const loadMore = async () => {
    if (history.nextBefore === null) {
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
      <h1>내 둥지 꾸미기</h1>
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

      <section aria-labelledby="nest-shop-title">
        <h2 id="nest-shop-title">상점</h2>
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
                data-testid={`nest-item-${item.code}`}
              >
                {isDecoration(item) ? (
                  <ItemPicture code={item.code} />
                ) : (
                  <NestScene look={preview(look, item)} width="100%" />
                )}
                <p className="nest-shop__name">{item.name}</p>
                <p className="nest-shop__price">
                  {item.price === 0 ? '기본' : `${item.price.toLocaleString('ko-KR')}점`}
                </p>
                <ShopButton
                  item={item}
                  balance={nest.balance}
                  busy={busy}
                  onBuy={() => void buy(item)}
                  onEquip={(on) => void equip(item, on)}
                />
              </li>
            ))}
        </ul>
      </section>

      <section aria-labelledby="nest-history-title">
        <h2 id="nest-history-title">포인트 기록</h2>
        {history.items.length === 0 ? (
          <p>아직 기록이 없어요</p>
        ) : (
          <ul className="nest-history">
            {history.items.map((entry) => (
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
        {history.nextBefore !== null ? (
          <p style={{ textAlign: 'center' }}>
            <button type="button" onClick={() => void loadMore()}>
              더 보기
            </button>
          </p>
        ) : null}
      </section>
      {dialog}
      {toast}
    </main>
  );
}

/** 여러 개 다는 물건(소품·새 장식)인가 — 배경·둥지는 하나만 */
function isDecoration(item: ShopItem): boolean {
  return item.kind === 'PROP' || item.kind === 'ACCESSORY';
}

/** 배경·둥지를 지금 둥지에 바꿔 놓아 본 모습 */
function preview(look: MyNest['nest'], item: ShopItem): MyNest['nest'] {
  return item.kind === 'BACKGROUND'
    ? { ...look, background: item.code }
    : { ...look, nestType: item.code };
}

/** 소품·새 장식은 그림만 크게 */
function ItemPicture({ code }: { code: string }) {
  return (
    <div className="nest-shop__picture">
      <img src={artUrl(code)} alt="" />
    </div>
  );
}

function ShopButton({
  item,
  balance,
  busy,
  onBuy,
  onEquip,
}: {
  item: ShopItem;
  balance: number;
  busy: boolean;
  onBuy: () => void;
  onEquip: (on: boolean) => void;
}) {
  if (!item.owned) {
    const short = balance < item.price;
    return (
      <button type="button" className="nest-buy" disabled={busy || short} onClick={onBuy}>
        {short ? `${(item.price - balance).toLocaleString('ko-KR')}점 모자라요` : '사기'}
      </button>
    );
  }
  if (item.equipped) {
    return isDecoration(item) ? (
      <button type="button" disabled={busy} onClick={() => onEquip(false)}>
        내리기
      </button>
    ) : (
      <button type="button" disabled>
        장착 중
      </button>
    );
  }
  return (
    <button type="button" disabled={busy} onClick={() => onEquip(true)}>
      장착
    </button>
  );
}
