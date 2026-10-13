import { Link } from 'react-router-dom';
import {
  listFriendRequests,
  listMyFriends,
  removeFriendship,
  requestFriendship,
  type FriendItem,
  type FriendRequestItem,
} from '../../api/friends';
import { ApiError } from '../../api/client';
import DefaultAvatar from '../../components/DefaultAvatar';
import LastActiveBadge from '../../components/LastActiveBadge';
import { useConfirm } from '../../components/useConfirm';
import { formatDate } from '../time/dateFormat';
import { useCursorList } from './useFriendLists';
import { useState } from 'react';
import { FRIEND_MESSAGES } from './friendMessages';

function Person({
  item,
}: {
  item: { handle: string; nickname: string; profileImageUrl: string | null };
}) {
  return (
    <>
      {item.profileImageUrl ? (
        <img src={item.profileImageUrl} alt="" width={32} height={32} className="friend-photo" />
      ) : (
        <DefaultAvatar nickname={item.nickname} handle={item.handle} size={32} />
      )}
      <Link to={`/@${item.handle}`} className="friend-name">
        <span>{item.nickname}</span> <span className="friend-handle">@{item.handle}</span>
      </Link>
    </>
  );
}

/** 버튼 처리 중 오류를 한곳에서 보인다. 실패하면 서버가 준 이유, 없으면 "잠시 후 다시 시도해 주세요". */
function useAct() {
  const [error, setError] = useState<string | null>(null);
  async function act(action: () => Promise<unknown>, after: () => void) {
    setError(null);
    try {
      await action();
      after();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : FRIEND_MESSAGES.failed);
    }
  }
  const errorView = error ? (
    <p role="alert" className="form-error">
      {error}
    </p>
  ) : null;
  return { act, errorView };
}

/**
 * 친구 화면의 "받은 친구 요청" 탭 (001 T133, FR-055): [수락]·[거절]. 처리한 줄은 목록에서 빠진다. 거절은 상대에게 알리지 않는다.
 */
export function FriendRequests() {
  const requests = useCursorList<FriendRequestItem>(listFriendRequests);
  const { act, errorView } = useAct();

  return (
    <section aria-labelledby="friend-requests-title" className="friend-section">
      <h2 id="friend-requests-title" className="visually-hidden">
        받은 친구 요청
      </h2>
      {requests.failed && <p className="field-error">목록을 불러오지 못했어요</p>}
      {!requests.loading && !requests.failed && requests.items.length === 0 && (
        <p className="friend-empty">받은 요청이 없어요</p>
      )}
      <ul className="friend-list">
        {requests.items.map((item) => (
          <li key={item.handle}>
            <Person item={item} />
            <span className="friend-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  void act(
                    () => requestFriendship(item.handle),
                    () => requests.removeItem(item.handle),
                  )
                }
              >
                수락
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  void act(
                    () => removeFriendship(item.handle),
                    () => requests.removeItem(item.handle),
                  )
                }
              >
                거절
              </button>
            </span>
          </li>
        ))}
      </ul>
      {requests.hasMore && (
        <button type="button" className="btn btn-ghost" onClick={() => void requests.loadMore()}>
          더 보기
        </button>
      )}
      {errorView}
    </section>
  );
}

/**
 * 친구 화면의 "내 친구" 탭 (001 T133, FR-056): 친구가 된 날·최근 활동, [친구 끊기](확인 후). 끊기는 상대에게 알리지 않는다.
 */
export function MyFriends() {
  const friends = useCursorList<FriendItem>(listMyFriends);
  const { confirm, dialog } = useConfirm();
  const { act, errorView } = useAct();

  return (
    <section aria-labelledby="friends-title" className="friend-section">
      <h2 id="friends-title" className="visually-hidden">
        내 친구
      </h2>
      {friends.failed && <p className="field-error">목록을 불러오지 못했어요</p>}
      {!friends.loading && !friends.failed && friends.items.length === 0 && (
        <p className="friend-empty">아직 친구가 없어요</p>
      )}
      <ul className="friend-list">
        {friends.items.map((item) => (
          <li key={item.handle}>
            <Person item={item} />
            <span className="friend-since">{formatDate(item.friendsSince)}부터</span>
            <LastActiveBadge value={item.lastActive} />
            <span className="friend-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={async () => {
                  const ok = await confirm({
                    title: '친구를 끊을까요?',
                    message: '상대에게 알리지 않아요. 끊은 뒤에는 서로의 최근 활동이 보이지 않아요.',
                    confirmLabel: '끊기',
                  });
                  if (ok) {
                    await act(
                      () => removeFriendship(item.handle),
                      () => friends.removeItem(item.handle),
                    );
                  }
                }}
              >
                친구 끊기
              </button>
            </span>
          </li>
        ))}
      </ul>
      {friends.hasMore && (
        <button type="button" className="btn btn-ghost" onClick={() => void friends.loadMore()}>
          더 보기
        </button>
      )}
      {errorView}
      {dialog}
    </section>
  );
}
