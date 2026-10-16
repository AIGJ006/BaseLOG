import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { listMyInquiries } from '../api/inquiries';
import type { Inquiry } from '../api/types/inquiry';
import { loginPathFor } from '../features/auth-gate/authGate';
import { useSession } from '../features/auth/useSession';
import InquiryCard from '../features/inquiry/InquiryCard';
import InquiryForm from '../features/inquiry/InquiryForm';
import { INQUIRY_TEXT, SUPPORT_PAGE_TITLE } from '../features/inquiry/inquiryText';
import '../features/inquiry/inquiry.css';

/**
 * 문의·신고 `/support?tab=mine` (023, 2026-10-14 민서 요청). 계정 메뉴의 [문의·신고]로 연다. 탭 [문의·신고하기](보내기)와
 * [내 문의·신고](새것부터, 상태·답변)로 나눈다(2026-10-15). 관리자가 답하면 🔔 알림이 [내 문의·신고] 탭으로 데려온다.
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

type SupportTab = 'write' | 'mine';

function Support() {
  const [params, setParams] = useSearchParams();
  const tab: SupportTab = params.get('tab') === 'mine' ? 'mine' : 'write';
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
      <div className="support-tabs" role="tablist" aria-label={SUPPORT_PAGE_TITLE}>
        {(['write', 'mine'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`support-tab-${value}`}
            aria-selected={tab === value}
            aria-controls={`support-panel-${value}`}
            tabIndex={tab === value ? 0 : -1}
            onClick={() => selectTab(value)}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const next: SupportTab = value === 'write' ? 'mine' : 'write';
              selectTab(next);
              document.getElementById(`support-tab-${next}`)?.focus();
            }}
          >
            {value === 'write' ? INQUIRY_TEXT.tabWrite : INQUIRY_TEXT.tabMine}
            {value === 'mine' && list.kind === 'ok' ? ` ${list.items.length}` : ''}
          </button>
        ))}
      </div>
      {/* 탭을 옮겨도 쓰던 내용이 남도록 둘 다 그려 두고 고른 것만 보인다 */}
      <div
        id="support-panel-write"
        role="tabpanel"
        aria-labelledby="support-tab-write"
        hidden={tab !== 'write'}
      >
        <InquiryForm onSent={onSent} />
      </div>
      <section
        id="support-panel-mine"
        role="tabpanel"
        aria-labelledby="support-tab-mine"
        aria-busy={list.kind === 'loading'}
        hidden={tab !== 'mine'}
      >
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

  function selectTab(value: SupportTab) {
    setParams(value === 'write' ? {} : { tab: value }, { replace: true });
  }
}
