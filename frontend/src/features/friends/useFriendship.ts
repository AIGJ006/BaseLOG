import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import {
  getFriendship,
  removeFriendship,
  requestFriendship,
  type FriendshipStatus,
  type FriendshipView,
} from '../../api/friends';
import { FRIEND_MESSAGES } from './friendMessages';

/**
 * 나와 그 회원의 친구 관계 (FR-054~056). `enabled`가 false(비로그인)면 읽지 않는다. `request`·`remove`는 응답 상태로 갱신하고, 실패하면
 * 상태를 그대로 두고 `error`에 이유를 둔다. `onChange`는 내가 누른 처리로 상태가 바뀌었을 때만 새 상태를 알린다(처음 읽기는 알리지 않음).
 */
export function useFriendship(
  handle: string,
  enabled: boolean,
  onChange?: (status: FriendshipStatus, previous: FriendshipStatus) => void,
) {
  const [view, setView] = useState<FriendshipView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const viewRef = useRef<FriendshipView | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let active = true;
    getFriendship(handle)
      .then((value) => {
        if (active) {
          viewRef.current = value;
          setView(value);
        }
      })
      .catch(() => {
        if (active) {
          viewRef.current = null;
          setView(null);
        }
      });
    return () => {
      active = false;
    };
  }, [handle, enabled]);

  const run = useCallback(async (action: () => Promise<FriendshipView>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      const previous = viewRef.current?.status;
      viewRef.current = next;
      setView(next);
      if (previous !== undefined && previous !== next.status) {
        onChangeRef.current?.(next.status, previous);
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : FRIEND_MESSAGES.failed);
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    view,
    error,
    busy,
    request: () => run(() => requestFriendship(handle)),
    remove: () => run(() => removeFriendship(handle)),
  };
}
