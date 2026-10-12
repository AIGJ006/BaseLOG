import { useLocation, useNavigate } from 'react-router-dom';
import type { FriendshipStatus } from '../api/friends';
import { useFriendship } from '../features/friends/useFriendship';
import { useSession } from '../features/auth/useSession';
import { useConfirm } from './useConfirm';
import '../features/friends/friends.css';

const UNFRIEND_CONFIRM = {
  title: '친구를 끊을까요?',
  message: '상대에게 알리지 않아요. 끊은 뒤에는 서로의 최근 활동이 보이지 않아요.',
  confirmLabel: '끊기',
};

export interface FriendButtonProps {
  /** 대상 블로그 주소 */
  handle: string;
  /** 내가 누른 처리로 관계가 바뀌면 새 상태와 이전 상태를 알린다 (블로그 머리말의 친구 수 갱신용) */
  onChange?: (status: FriendshipStatus, previous: FriendshipStatus) => void;
}

/**
 * 친구 버튼 (001 T132, FR-054~056). 블로그 머리말과 글 상세 작성자 카드에 둔다.
 *
 * - `SELF` 숨김, `NONE` [친구 요청], `REQUEST_SENT` [요청 취소], `REQUEST_RECEIVED` [수락]·[거절], `FRIENDS` [친구 ✓](누르면 확인 후 끊기).
 * - 모양: 요청·수락은 채운 단추(`.btn-primary`), 취소·거절은 조용한 단추(`.btn-ghost`), 친구 상태는 테두리 단추.
 *   [친구 ✓]의 화면 읽기 이름은 "친구 끊기"다(보이는 글자 "친구"를 포함).
 * - 비로그인은 [친구 요청]을 누르면 `/login?returnTo=지금 주소`로.
 * - 처리 후 서버가 돌려준 상태로 바꾼다. 거절·취소·끊기는 상대에게 알리지 않는다.
 */
export default function FriendButton({ handle, onChange }: FriendButtonProps) {
  const { me, loading } = useSession();
  const loggedIn = !loading && me !== null;
  const { view, error, busy, request, remove } = useFriendship(handle, loggedIn, onChange);
  const { confirm, dialog } = useConfirm();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return null;
  }
  if (!loggedIn) {
    return (
      <span className="friend-button" data-status="ANONYMOUS">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() =>
            navigate(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`)
          }
        >
          친구 요청
        </button>
      </span>
    );
  }
  if (!view || view.status === 'SELF') {
    return null;
  }

  let buttons;
  switch (view.status) {
    case 'NONE':
      buttons = (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => void request()}
          disabled={busy}
        >
          친구 요청
        </button>
      );
      break;
    case 'REQUEST_SENT':
      buttons = (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void remove()}
          disabled={busy}
        >
          요청 취소
        </button>
      );
      break;
    case 'REQUEST_RECEIVED':
      buttons = (
        <>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void request()}
            disabled={busy}
          >
            수락
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void remove()}
            disabled={busy}
          >
            거절
          </button>
        </>
      );
      break;
    case 'FRIENDS':
      buttons = (
        <button
          type="button"
          className="btn btn-ghost friend-button__friends"
          aria-label="친구 끊기"
          title="친구 끊기"
          disabled={busy}
          onClick={async () => {
            if (await confirm(UNFRIEND_CONFIRM)) {
              await remove();
            }
          }}
        >
          친구
          <span aria-hidden="true">{' ✓'}</span>
        </button>
      );
      break;
  }

  return (
    <span className="friend-button" data-status={view.status}>
      {buttons}
      {error && (
        <span role="alert" className="field-error">
          {error}
        </span>
      )}
      {dialog}
    </span>
  );
}
