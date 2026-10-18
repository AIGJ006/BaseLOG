import { useEffect, useRef, useState } from 'react';
import { getCollaborators, MAX_COLLABORATORS, type Collaborator } from '../../api/collaborators';
import { listMyFriends } from '../../api/friends';
import DefaultAvatar from '../../components/DefaultAvatar';
import type { CollaboratorSelection } from './collaboratorSelection';
import './collaborators.css';

export const NO_FRIENDS_TEXT = '친구를 맺으면 공동 작업자로 고를 수 있어요';
export const COLLABORATOR_HELP = '공동 작업자는 등록된 글의 제목과 본문만 고칠 수 있어요';
const LOAD_FAILED = '공동 작업자 목록을 불러오지 못했어요';

type Status = 'loading' | 'ready' | 'error';

/** 고른 사람을 앞에, 그 뒤에 아직 안 고른 친구 (고른 사람이 친구 목록 첫 페이지에 없어도 보이게). */
function rowsOf(selected: Collaborator[], friends: Collaborator[]): Collaborator[] {
  const chosen = new Set(selected.map((person) => person.handle));
  return [...selected, ...friends.filter((friend) => !chosen.has(friend.handle))];
}

/**
 * 등록 설정 창의 "공동 작업자" 칸 (작성자만). 지금 목록(`GET /api/posts/{postId}/collaborators`)을 읽은 뒤 내 친구 목록을
 * 읽어 체크 칸으로 보인다. 최대 3명 — 3명을 고르면 나머지 칸은 꺼진다. 저장은 등록 창이 [등록]이 성공한 뒤에 한다(임시글은 등록된 뒤라야
 * 추가 알림이 간다). 읽지 못하면(옛 서버 등) 칸 안에 짧게 알리고 등록은 그대로 된다.
 */
export default function CollaboratorPicker({
  postId,
  selection,
  onLoaded,
  onChange,
  disabled = false,
  note = null,
  error = null,
}: Readonly<{
  postId: number;
  selection: CollaboratorSelection | null;
  onLoaded: (items: Collaborator[]) => void;
  onChange: (selected: Collaborator[]) => void;
  disabled?: boolean;
  /** 칸을 끈 까닭 (예: 나만 보기 글) — 도움말 아래에 보인다 */
  note?: string | null;
  /** 저장 실패 문구 (400 `TOO_MANY_COLLABORATORS`·`COLLABORATOR_NOT_FRIEND`의 서버 문구) */
  error?: string | null;
}>) {
  const [friends, setFriends] = useState<Collaborator[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreFailed, setMoreFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const onLoadedRef = useRef(onLoaded);
  useEffect(() => {
    onLoadedRef.current = onLoaded;
  });

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const current = await getCollaborators(postId);
        const page = await listMyFriends();
        if (!active) return;
        onLoadedRef.current(current.items);
        setFriends(page.items);
        setNextCursor(page.nextCursor);
        setStatus('ready');
      } catch {
        if (active) setStatus('error');
      }
    })();
    return () => {
      active = false;
    };
  }, [postId, attempt]);

  function retry() {
    setStatus('loading');
    setAttempt((n) => n + 1);
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMoreFailed(false);
    try {
      const page = await listMyFriends(nextCursor);
      setFriends((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      setMoreFailed(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const selected = selection?.selected ?? [];
  const ready = status === 'ready' && selection !== null;

  function toggle(person: Collaborator) {
    const chosen = selected.some((p) => p.handle === person.handle);
    onChange(chosen ? selected.filter((p) => p.handle !== person.handle) : [...selected, person]);
  }

  const rows = rowsOf(selected, friends);
  const full = selected.length >= MAX_COLLABORATORS;

  return (
    <fieldset className="collaborator-picker">
      <legend>
        공동 작업자{' '}
        <span className="collaborator-count">
          {selected.length} / {MAX_COLLABORATORS}
        </span>
      </legend>
      <p className="collaborator-help">{COLLABORATOR_HELP}</p>
      {note ? <p className="collaborator-note">{note}</p> : null}
      {status === 'loading' ? <p className="collaborator-help">불러오는 중…</p> : null}
      {status === 'error' ? (
        <p className="collaborator-empty">
          {LOAD_FAILED}{' '}
          <button type="button" className="btn btn-ghost collaborator-more" onClick={retry}>
            다시 시도
          </button>
        </p>
      ) : null}
      {ready && rows.length === 0 ? <p className="collaborator-empty">{NO_FRIENDS_TEXT}</p> : null}
      {ready && rows.length > 0 ? (
        <ul className="collaborator-list">
          {rows.map((person) => {
            const checked = selected.some((p) => p.handle === person.handle);
            return (
              <li key={person.handle}>
                <label className="collaborator-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || (!checked && full)}
                    onChange={() => toggle(person)}
                  />
                  {person.profileImageUrl ? (
                    <img
                      src={person.profileImageUrl}
                      alt=""
                      width={28}
                      height={28}
                      loading="lazy"
                      className="collaborator-avatar"
                    />
                  ) : (
                    <DefaultAvatar nickname={person.nickname} handle={person.handle} size={28} />
                  )}
                  <span className="collaborator-name">{person.nickname}</span>
                  <span className="collaborator-handle">@{person.handle}</span>
                </label>
              </li>
            );
          })}
        </ul>
      ) : null}
      {ready && nextCursor ? (
        <button
          type="button"
          className="btn btn-ghost collaborator-more"
          onClick={() => void loadMore()}
          disabled={loadingMore}
        >
          {loadingMore ? '불러오는 중…' : '더 보기'}
        </button>
      ) : null}
      {moreFailed ? <p className="collaborator-empty">{LOAD_FAILED}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </fieldset>
  );
}
