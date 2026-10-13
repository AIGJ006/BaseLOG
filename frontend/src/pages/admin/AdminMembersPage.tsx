import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getAdminMembers } from '../../api/admin';
import type { AdminMemberList, AdminMemberRow } from '../../api/types/moderation';
import AdminNav from '../../features/admin/AdminNav';
import { ADMIN_TEXT, MEMBER_STATUS_LABELS, PROVIDER_LABELS } from '../../features/admin/adminText';
import '../../features/admin/admin.css';
import { formatDate, formatDateTime } from '../../features/time/dateFormat';

type MemberStatus = AdminMemberRow['status'];

/** 탈퇴 신청한 회원은 목록에 나오지 않아 거르기에도 없다 */
const STATUSES: MemberStatus[] = ['ACTIVE', 'SUSPENDED'];

/** 받은 결과와 그 결과를 부른 조건. 조건이 바뀌면 새 결과가 올 때까지 앞 목록을 그대로 둔다 */
type Result = { key: string } & ({ kind: 'error' } | { kind: 'ok'; list: AdminMemberList });

function readStatus(raw: string | null): MemberStatus | null {
  return raw !== null && (STATUSES as string[]).includes(raw) ? (raw as MemberStatus) : null;
}

function readPage(raw: string | null): number {
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/**
 * 가입 회원 목록 `/admin/members?q&status&page` (관리자만, 004 `AdminRouteGate` 아래). 가입 최근 순 20명씩, 탈퇴 신청한 회원은 빠진다. 주소·닉네임·
 * 이메일로 찾고 상태로 거른다. 이름을 누르면 회원 한 명 화면(정지·이력)으로 간다. 이메일은 이 화면에만 나온다.
 */
export default function AdminMembersPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const status = readStatus(params.get('status'));
  const page = readPage(params.get('page'));
  const [result, setResult] = useState<Result | null>(null);
  const [retry, setRetry] = useState(0);
  const key = JSON.stringify([q, status, page, retry]);

  useEffect(() => {
    let cancelled = false;
    getAdminMembers({ q, status, page })
      .then((list) => !cancelled && setResult({ key, kind: 'ok', list }))
      .catch(() => !cancelled && setResult({ key, kind: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [key, q, status, page]);

  function go(next: { q?: string; status?: MemberStatus | null; page?: number }) {
    const merged = { q, status, page: 1, ...next };
    const search = new URLSearchParams();
    if (merged.q.trim() !== '') search.set('q', merged.q.trim());
    if (merged.status) search.set('status', merged.status);
    if (merged.page > 1) search.set('page', String(merged.page));
    setParams(search);
  }

  const loading = result?.key !== key;
  const failed = !loading && result?.kind === 'error';
  const list = result?.kind === 'ok' ? result.list : null;
  const filtered = q !== '' || status !== null;

  return (
    <main className="admin-page" data-route="admin-members">
      <AdminNav />
      <div className="admin-title-row">
        <h1>{ADMIN_TEXT.membersTitle}</h1>
        {list ? (
          <span className="admin-muted" data-testid="member-total">
            {ADMIN_TEXT.membersTotal(list.total)}
          </span>
        ) : null}
      </div>
      <SearchForm
        key={q}
        q={q}
        status={status}
        onSearch={(nextQ, nextStatus) => go({ q: nextQ, status: nextStatus })}
      />
      {failed ? (
        <p role="alert" className="admin-error">
          {ADMIN_TEXT.loadFailed}{' '}
          <button type="button" className="admin-button" onClick={() => setRetry((n) => n + 1)}>
            {ADMIN_TEXT.reload}
          </button>
        </p>
      ) : null}
      {loading && !list ? <p className="admin-muted">{ADMIN_TEXT.loading}</p> : null}
      {list ? (
        list.items.length === 0 ? (
          <p className="admin-muted">
            {filtered ? ADMIN_TEXT.membersNoMatch : ADMIN_TEXT.membersEmpty}
          </p>
        ) : (
          <ul className="case-list" data-testid="member-list">
            {list.items.map((member) => (
              <MemberItem key={member.handle} member={member} />
            ))}
          </ul>
        )
      ) : null}
      {list && list.totalPages > 1 ? (
        <nav className="admin-pager" aria-label="쪽">
          <button
            type="button"
            className="admin-button"
            disabled={page <= 1}
            onClick={() => go({ page: page - 1 })}
          >
            {ADMIN_TEXT.previous}
          </button>
          <span className="admin-muted" aria-current="page">
            {page} / {list.totalPages}
          </span>
          <button
            type="button"
            className="admin-button"
            disabled={page >= list.totalPages}
            onClick={() => go({ page: page + 1 })}
          >
            {ADMIN_TEXT.next}
          </button>
        </nav>
      ) : null}
    </main>
  );
}

/** 검색어 칸은 주소창의 검색어가 바뀌면(`key`) 새로 채운다. 상태를 고르면 바로 찾는다 */
function SearchForm({
  q,
  status,
  onSearch,
}: {
  q: string;
  status: MemberStatus | null;
  onSearch: (q: string, status: MemberStatus | null) => void;
}) {
  const [draft, setDraft] = useState(q);
  return (
    <form
      className="admin-search"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft, status);
      }}
    >
      <input
        className="admin-input"
        type="search"
        aria-label={ADMIN_TEXT.memberSearchLabel}
        placeholder={ADMIN_TEXT.memberSearchLabel}
        maxLength={100}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      <select
        className="admin-input"
        aria-label={ADMIN_TEXT.memberStatusLabel}
        value={status ?? ''}
        onChange={(event) => onSearch(draft, readStatus(event.target.value))}
      >
        <option value="">{ADMIN_TEXT.allStatuses}</option>
        {STATUSES.map((code) => (
          <option key={code} value={code}>
            {MEMBER_STATUS_LABELS[code]}
          </option>
        ))}
      </select>
      <button type="submit" className="admin-button">
        {ADMIN_TEXT.search}
      </button>
    </form>
  );
}

function MemberItem({ member }: { member: AdminMemberRow }) {
  return (
    <li className="case-item" data-testid="member-item">
      <div className="case-item-head">
        <Link
          to={`/admin/members/${encodeURIComponent(member.handle)}`}
          className="case-item-title"
        >
          {member.nickname}
        </Link>
        <span className="admin-muted">@{member.handle}</span>
        {member.role === 'ADMIN' ? <span className="admin-badge">{ADMIN_TEXT.admin}</span> : null}
        {member.status === 'SUSPENDED' ? (
          <span className="admin-badge" data-status={member.status}>
            {MEMBER_STATUS_LABELS[member.status]}
          </span>
        ) : null}
      </div>
      <div className="case-item-meta">
        <span>{member.email ?? ADMIN_TEXT.noEmail}</span>
        {member.provider ? <span>{PROVIDER_LABELS[member.provider]}</span> : null}
        <span>
          {ADMIN_TEXT.joined} {formatDate(member.joinedAt)}
        </span>
        <span>
          {member.lastLoginAt
            ? `${ADMIN_TEXT.lastLogin} ${formatDateTime(member.lastLoginAt)}`
            : ADMIN_TEXT.neverLoggedIn}
        </span>
      </div>
    </li>
  );
}
