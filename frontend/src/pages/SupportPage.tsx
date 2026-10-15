import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { listMyInquiries } from '../api/inquiries';
import type { Inquiry } from '../api/types/inquiry';
import { loginPathFor } from '../features/auth-gate/authGate';
import { useSession } from '../features/auth/useSession';
import InquiryCard from '../features/inquiry/InquiryCard';
import InquiryForm from '../features/inquiry/InquiryForm';
import { INQUIRY_TEXT, SUPPORT_PAGE_TITLE } from '../features/inquiry/inquiryText';
import '../features/inquiry/inquiry.css';

/**
 * 문의·신고 `/support` (023, 2026-10-14 민서 요청). 계정 메뉴의 [문의·신고]로 연다. 위는 문의 보내기, 아래는 "내가 보낸 문의"(새것부터,
 * 상태·답변). 관리자가 답하면 🔔 알림이 이 화면으로 데려온다.
 *
 * 로그인 전용: 비로그인이면 `/login?returnTo=…`로 보낸다(서버도 401).
 */
export default function SupportPage() {
  const { loading, me } = useSession();
  const location = useLocation();
  if (loading) {
    return <main data-route="support" aria-busy="true" className="support-page" />;
  }
  if (!me) {
    return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  }
  return <Support />;
}

type ListState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ok'; items: Inquiry[] };

function Support() {
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listMyInquiries()
      .then((result) => !cancelled && setList({ kind: 'ok', items: result.items }))
      .catch(() => !cancelled && setList({ kind: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [retry]);

  const onSent = useCallback((sent: Inquiry) => {
    setList((current) =>
      current.kind === 'ok'
        ? { kind: 'ok', items: [sent, ...current.items.filter((item) => item.id !== sent.id)] }
        : { kind: 'ok', items: [sent] },
    );
  }, []);

  let myList: ReactNode = null;
  if (list.kind === 'ok') {
    myList =
      list.items.length === 0 ? (
        <p className="support-lead">{INQUIRY_TEXT.myEmpty}</p>
      ) : (
        <ul className="inquiry-list" data-testid="my-inquiries">
          {list.items.map((item) => (
            <InquiryCard key={item.id} inquiry={item} />
          ))}
        </ul>
      );
  }

  return (
    <main data-route="support" className="support-page">
      <header>
        <h1>{SUPPORT_PAGE_TITLE}</h1>
        <p className="support-lead">{INQUIRY_TEXT.lead}</p>
      </header>
      <InquiryForm onSent={onSent} />
      <section aria-labelledby="my-inquiries-title" aria-busy={list.kind === 'loading'}>
        <h2 id="my-inquiries-title">{INQUIRY_TEXT.myTitle}</h2>
        {list.kind === 'loading' ? <p className="support-lead">{INQUIRY_TEXT.loading}</p> : null}
        {list.kind === 'error' ? (
          <p role="alert" className="form-error">
            {INQUIRY_TEXT.loadFailed}{' '}
            <button
              type="button"
              className="inquiry-button"
              onClick={() => {
                setList({ kind: 'loading' });
                setRetry((n) => n + 1);
              }}
            >
              {INQUIRY_TEXT.reload}
            </button>
          </p>
        ) : null}
        {myList}
      </section>
    </main>
  );
}
