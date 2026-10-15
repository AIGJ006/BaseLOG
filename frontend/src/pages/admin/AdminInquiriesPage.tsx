import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { answerInquiry, listAdminInquiries } from '../../api/inquiries';
import type { AdminInquiry, AdminInquiryPage, InquiryStatus } from '../../api/types/inquiry';
import { useToast } from '../../components/useToast';
import AdminNav from '../../features/admin/AdminNav';
import { ADMIN_TEXT, adminErrorMessage } from '../../features/admin/adminText';
import '../../features/admin/admin.css';
import InquiryCard from '../../features/inquiry/InquiryCard';
import { INQUIRY_ANSWER_MAX } from '../../features/inquiry/inquiryText';
import '../../features/inquiry/inquiry.css';

/**
 * 문의 `/admin/inquiries?status=received|answered` (023, 관리자만 — 004 `AdminRouteGate` 아래). 새것부터 20개씩 [더 보기].
 * 문의마다 보낸 회원(닉네임·@주소 → 회원 화면)·종류·내용·사진과 답변 칸이 있다. 답을 보내면 답변 완료가 되고 회원에게 🔔 알림이 간다(처음
 * 답할 때만). 이미 답한 문의는 답을 고칠 수 있다.
 */
export default function AdminInquiriesPage() {
  const [params, setParams] = useSearchParams();
  const status: InquiryStatus = params.get('status') === 'answered' ? 'ANSWERED' : 'RECEIVED';
  return (
    <main className="admin-page" data-route="admin-inquiries">
      <AdminNav />
      <h1>{ADMIN_TEXT.inquiriesTitle}</h1>
      <nav className="admin-tabs" aria-label="문의 탭">
        <Link
          to="/admin/inquiries?status=received"
          aria-current={status === 'RECEIVED' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setParams({ status: 'received' });
          }}
        >
          {ADMIN_TEXT.inquiryTabReceived}
        </Link>
        <Link
          to="/admin/inquiries?status=answered"
          aria-current={status === 'ANSWERED' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault();
            setParams({ status: 'answered' });
          }}
        >
          {ADMIN_TEXT.inquiryTabAnswered}
        </Link>
      </nav>
      <InquiryTabList key={status} status={status} />
    </main>
  );
}

type Status = 'loading' | 'idle' | 'error';

function InquiryTabList({ status }: Readonly<{ status: InquiryStatus }>) {
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

  const { show, toast } = useToast();
  // 접수 탭에서 답하면 그 문의는 답변 완료 탭으로 옮겨 가니 목록에서 뺀다(토스트는 카드가 사라져도 남게 목록에 둔다).
  const replace = useCallback(
    (saved: AdminInquiry, wasAnswered: boolean) => {
      setItems((previous) =>
        saved.status === status
          ? previous.map((item) => (item.id === saved.id ? saved : item))
          : previous.filter((item) => item.id !== saved.id),
      );
      show({ text: wasAnswered ? ADMIN_TEXT.answerUpdated : ADMIN_TEXT.answerSaved });
    },
    [show, status],
  );

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
        <ul className="inquiry-list" data-testid="admin-inquiries">
          {items.map((item) => (
            <InquiryCard key={item.id} inquiry={item} who={<Member item={item} />}>
              <AnswerForm item={item} onSaved={replace} />
            </InquiryCard>
          ))}
        </ul>
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
      {toast}
      {state === 'error' && items.length > 0 ? (
        <p role="alert" className="admin-error">
          {ADMIN_TEXT.loadFailed}
        </p>
      ) : null}
    </section>
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
