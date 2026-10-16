import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { answerInquiry, getAdminInquiry, listAdminInquiries } from '../../api/inquiries';
import type { AdminInquiry, AdminInquiryPage, InquiryStatus } from '../../api/types/inquiry';
import { useToast } from '../../components/useToast';
import AdminNav from '../../features/admin/AdminNav';
import { ADMIN_TEXT, adminErrorMessage } from '../../features/admin/adminText';
import '../../features/admin/admin.css';
import InquiryCard from '../../features/inquiry/InquiryCard';
import { formatDate } from '../../features/time/dateFormat';
import {
  ADMIN_STATUS_LABELS,
  CATEGORY_LABELS,
  INQUIRY_ANSWER_MAX,
} from '../../features/inquiry/inquiryText';
import '../../features/inquiry/inquiry.css';

/** 목록 탭: 전체 · 처리 전 · 처리 완료 (2026-10-15 민서 요청, 릴리스 노트처럼 한 줄씩) */
const TABS: {
  key: 'all' | 'received' | 'answered';
  status: InquiryStatus | null;
  label: string;
}[] = [
  { key: 'all', status: null, label: ADMIN_TEXT.inquiryTabAll },
  { key: 'received', status: 'RECEIVED', label: ADMIN_TEXT.inquiryTabReceived },
  { key: 'answered', status: 'ANSWERED', label: ADMIN_TEXT.inquiryTabAnswered },
];

/**
 * 문의 목록 `/admin/inquiries?status=received|answered` (023, 관리자만 — 004 `AdminRouteGate` 아래). 새것부터 20개씩 [더 보기].
 * 한 줄에 상태(처리 전·처리 완료)·종류·내용 첫머리·보낸 회원·날짜를 보이고, 누르면 `/admin/inquiries/:id`에서 내용과 답변 칸을 연다.
 */
export default function AdminInquiriesPage() {
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t.key === params.get('status')) ?? TABS[0];
  return (
    <main className="admin-page" data-route="admin-inquiries">
      <AdminNav />
      <h1>{ADMIN_TEXT.inquiriesTitle}</h1>
      <nav className="admin-tabs" aria-label="문의 탭">
        {TABS.map((t) => {
          const to = t.key === 'all' ? '/admin/inquiries' : `/admin/inquiries?status=${t.key}`;
          return (
            <Link
              key={t.key}
              to={to}
              aria-current={t.key === tab.key ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                setParams(t.key === 'all' ? {} : { status: t.key });
              }}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      <InquiryRows key={tab.key} status={tab.status} />
    </main>
  );
}

type Status = 'loading' | 'idle' | 'error';

function InquiryRows({ status }: Readonly<{ status: InquiryStatus | null }>) {
  const { search } = useLocation();
  const [items, setItems] = useState<AdminInquiry[]>([]);
  const [nextBefore, setNextBefore] = useState<number | null>(null);
  const [state, setState] = useState<Status>('loading');
  const inFlight = useRef(false);

  const receive = useCallback((page: AdminInquiryPage, append: boolean) => {
    setItems((previous) => {
      if (!append) return page.items;
      const seen = new Set(previous.map((item) => item.id));
      return [...previous, ...page.items.filter((item) => !seen.has(item.id))];
    });
    setNextBefore(page.nextBefore);
    setState('idle');
  }, []);

  const load = useCallback(
    async (before: number | null) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setState('loading');
      try {
        receive(await listAdminInquiries(status, before), before !== null);
      } catch {
        setState('error');
      } finally {
        inFlight.current = false;
      }
    },
    [receive, status],
  );

  useEffect(() => {
    let cancelled = false;
    inFlight.current = true;
    listAdminInquiries(status, null)
      .then((page) => !cancelled && receive(page, false))
      .catch(() => !cancelled && setState('error'))
      .finally(() => {
        inFlight.current = false;
      });
    return () => {
      cancelled = true;
    };
  }, [receive, status]);

  return (
    <section aria-busy={state === 'loading'}>
      {state === 'error' && items.length === 0 ? (
        <p role="alert" className="admin-error">
          {ADMIN_TEXT.loadFailed}{' '}
          <button type="button" className="admin-button" onClick={() => void load(null)}>
            {ADMIN_TEXT.reload}
          </button>
        </p>
      ) : null}
      {state === 'loading' && items.length === 0 ? (
        <p className="admin-muted">{ADMIN_TEXT.loading}</p>
      ) : null}
      {state !== 'loading' && state !== 'error' && items.length === 0 ? (
        <p className="admin-muted">{ADMIN_TEXT.inquiriesEmpty}</p>
      ) : null}
      {items.length > 0 ? (
        <ol className="inquiry-rows" data-testid="admin-inquiries">
          {items.map((item) => (
            <li key={item.id} data-testid="inquiry-row" data-status={item.status}>
              <Link
                to={`/admin/inquiries/${item.id}`}
                state={{ listSearch: search }}
                className="inquiry-row"
              >
                <span className="inquiry-status" data-status={item.status}>
                  {ADMIN_STATUS_LABELS[item.status]}
                </span>
                <span className="inquiry-row-main">
                  <span className="inquiry-row-category">{CATEGORY_LABELS[item.category]}</span>
                  <span className="inquiry-row-content">{item.content}</span>
                </span>
                <span className="inquiry-row-who">{memberLabel(item)}</span>
                <time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time>
              </Link>
            </li>
          ))}
        </ol>
      ) : null}
      {nextBefore ? (
        <button
          type="button"
          className="admin-button"
          disabled={state === 'loading'}
          onClick={() => void load(nextBefore)}
        >
          {state === 'loading' ? ADMIN_TEXT.loading : ADMIN_TEXT.more}
        </button>
      ) : null}
      {state === 'error' && items.length > 0 ? (
        <p role="alert" className="admin-error">
          {ADMIN_TEXT.loadFailed}
        </p>
      ) : null}
    </section>
  );
}

function memberLabel(item: AdminInquiry): string {
  const { handle, nickname, withdrawn } = item.member;
  return withdrawn || !handle ? ADMIN_TEXT.withdrawnMember : `${nickname} @${handle}`;
}

/** 상세에서 [목록으로]가 돌아갈 주소. 목록에서 넘겨받은 상태 탭(처리 전·완료)을 지키고, 모르는 값이면 전체 목록 */
function listPathFrom(state: unknown): string {
  const raw = (state as { listSearch?: unknown } | null)?.listSearch;
  const key = typeof raw === 'string' ? new URLSearchParams(raw).get('status') : null;
  const tab = TABS.find((t) => t.key === key && t.status !== null);
  return tab ? `/admin/inquiries?status=${tab.key}` : '/admin/inquiries';
}

type Detail =
  { kind: 'loading' } | { kind: 'error'; gone: boolean } | { kind: 'ok'; item: AdminInquiry };

/** 문의 하나 `/admin/inquiries/:id`: 보낸 회원·종류·내용·사진과 답변 칸. 답을 보내면 처리 완료가 되고 회원에게 🔔 알림이 간다(처음만). */
export function AdminInquiryPage() {
  const { inquiryId } = useParams();
  const id = Number(inquiryId);
  const [detail, setDetail] = useState<Detail>({ kind: 'loading' });
  const [retry, setRetry] = useState(0);
  const { show, toast } = useToast();
  const listPath = listPathFrom(useLocation().state);

  useEffect(() => {
    let cancelled = false;
    getAdminInquiry(id)
      .then((item) => !cancelled && setDetail({ kind: 'ok', item }))
      .catch(
        (caught) =>
          !cancelled &&
          setDetail({ kind: 'error', gone: caught instanceof ApiError && caught.status === 404 }),
      );
    return () => {
      cancelled = true;
    };
  }, [id, retry]);

  return (
    <main className="admin-page" data-route="admin-inquiry">
      <AdminNav />
      <p className="inquiry-back">
        <Link to={listPath}>{ADMIN_TEXT.inquiryBack}</Link>
      </p>
      <h1>{ADMIN_TEXT.inquiriesTitle}</h1>
      {detail.kind === 'loading' ? <p className="admin-muted">{ADMIN_TEXT.loading}</p> : null}
      {detail.kind === 'error' ? (
        <p role="alert" className="admin-error">
          {detail.gone ? ADMIN_TEXT.inquiryGone : ADMIN_TEXT.loadFailed}{' '}
          {detail.gone ? null : (
            <button type="button" className="admin-button" onClick={() => setRetry((n) => n + 1)}>
              {ADMIN_TEXT.reload}
            </button>
          )}
        </p>
      ) : null}
      {detail.kind === 'ok' ? (
        <ul className="inquiry-list">
          <InquiryCard
            inquiry={detail.item}
            who={<Member item={detail.item} />}
            statusLabels={ADMIN_STATUS_LABELS}
          >
            <AnswerForm
              key={detail.item.answeredAt ?? 'new'}
              item={detail.item}
              onSaved={(saved, wasAnswered) => {
                setDetail({ kind: 'ok', item: saved });
                show({ text: wasAnswered ? ADMIN_TEXT.answerUpdated : ADMIN_TEXT.answerSaved });
              }}
            />
          </InquiryCard>
        </ul>
      ) : null}
      {toast}
    </main>
  );
}

function Member({ item }: Readonly<{ item: AdminInquiry }>) {
  const { handle, nickname, withdrawn } = item.member;
  if (withdrawn || !handle) {
    return <span>{ADMIN_TEXT.withdrawnMember}</span>;
  }
  return (
    <Link to={`/admin/members/${encodeURIComponent(handle)}`}>
      {nickname} @{handle}
    </Link>
  );
}

function AnswerForm({
  item,
  onSaved,
}: Readonly<{
  item: AdminInquiry;
  onSaved: (saved: AdminInquiry, wasAnswered: boolean) => void;
}>) {
  const [answer, setAnswer] = useState(item.answer ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const answered = item.status === 'ANSWERED';
  const count = Array.from(answer).length;
  const over = count > INQUIRY_ANSWER_MAX;
  const fieldId = `inquiry-answer-${item.id}`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (answer.trim() === '') {
      setError(ADMIN_TEXT.answerRequired);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await answerInquiry(item.id, answer.trim());
      setAnswer(saved.answer ?? '');
      onSaved(saved, answered);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.status === 404
          ? ADMIN_TEXT.inquiryGone
          : adminErrorMessage(caught),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inquiry-answer-form" onSubmit={(event) => void submit(event)} noValidate>
      <label htmlFor={fieldId}>{ADMIN_TEXT.answerLabel}</label>
      <textarea
        id={fieldId}
        className="admin-textarea"
        rows={4}
        value={answer}
        aria-invalid={over ? true : undefined}
        onChange={(event) => setAnswer(event.target.value)}
      />
      <span className="admin-muted admin-counter">
        {count}/{INQUIRY_ANSWER_MAX}
      </span>
      {error ? (
        <p role="alert" className="admin-error">
          {error}
        </p>
      ) : null}
      <div className="admin-actions">
        <button type="submit" className="admin-button" disabled={busy || over}>
          {answered ? ADMIN_TEXT.answerEdit : ADMIN_TEXT.answerSave}
        </button>
      </div>
    </form>
  );
}
