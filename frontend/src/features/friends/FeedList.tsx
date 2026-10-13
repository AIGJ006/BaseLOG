import { useCallback, useState } from 'react';
import { Link, useNavigationType } from 'react-router-dom';
import { getFeed } from '../../api/feed';
import LoadMoreButton, { INITIAL_LOAD_FAILED_TEXT } from '../../components/LoadMoreButton';
import PostCard from '../../components/PostCard';
import PostCardGrid from '../../components/PostCardGrid';
import { FRIEND_MESSAGES } from './friendMessages';
import { useCursorList } from '../post-list/useCursorList';
import './friends.css';

/** 피드 목록의 복원 저장소 키 (FR-022). */
export const FEED_LIST_KEY = 'feed';

/**
 * 친구 피드 (010 T029, US2, FR-017~022, research R9). 수락된 친구의 공개 글만 보인다. 친구 화면(`/friends`)의 [피드] 탭으로
 * 그린다(2026-10-13 머리말 [피드]에서 옮김). 로그인 확인은 친구 화면이 한다.
 *
 * - 홈과 같은 카드·9개·[더 보기]·첫 목록 실패 문구, 뒤로 가기(POP)로 돌아오면 30분 안의 보관값으로 복원(`listKey: 'feed'`).
 * - 빈 상태 두 가지: 친구가 없으면 "아직 친구가 없어요…[홈]", 있지만 공개 글이 없으면 "친구의 공개 글이 아직 없어요"
 *   (첫 응답의 `hasFriends`).
 */
export default function FeedList() {
  const navigationType = useNavigationType();
  const [hasFriends, setHasFriends] = useState(true);
  const load = useCallback(async (cursor?: string | null) => {
    const page = await getFeed(cursor);
    if (!cursor) {
      setHasFriends(page.hasFriends);
    }
    return page;
  }, []);
  const list = useCursorList(load, { listKey: FEED_LIST_KEY, restore: navigationType === 'POP' });
  const empty = list.loadedOnce && list.items.length === 0;

  return (
    <section data-route="feed" aria-label="피드">
      <PostCardGrid>
        {list.items.map((card) => (
          <PostCard key={card.id} card={card} showAuthor />
        ))}
      </PostCardGrid>
      {list.initialError ? (
        <p role="status" className="feed-empty">
          {INITIAL_LOAD_FAILED_TEXT}{' '}
          <button type="button" onClick={() => void list.retry()}>
            다시 시도
          </button>
        </p>
      ) : empty ? (
        <p data-testid="empty-feed" className="feed-empty">
          {hasFriends ? (
            FRIEND_MESSAGES.feedNoPosts
          ) : (
            <>
              {FRIEND_MESSAGES.feedNoFriends} <Link to="/">홈</Link>
            </>
          )}
        </p>
      ) : (
        <LoadMoreButton
          status={list.status}
          done={list.done}
          onLoadMore={() => void list.loadMore()}
          onRetry={() => void list.retry()}
        />
      )}
    </section>
  );
}
