import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { loginPathFor } from '../features/auth-gate/authGate';
import { useSession } from '../features/auth/useSession';
import FeedList from '../features/friends/FeedList';
import { FriendRequests, MyFriends } from '../features/friends/FriendLists';
import type { FriendsTab } from '../features/friends/friendMessages';
import '../features/friends/friends.css';

const TABS: { tab: FriendsTab; label: string }[] = [
  { tab: 'feed', label: '피드' },
  { tab: 'requests', label: '받은 요청' },
  { tab: 'friends', label: '내 친구' },
];

function parseTab(value: string | null): FriendsTab {
  return TABS.some(({ tab }) => tab === value) ? (value as FriendsTab) : 'feed';
}

/**
 * 친구 화면 `/friends?tab=feed|requests|friends` (2026-10-13, 설정의 친구 영역과 머리말 [피드]를 한곳에 모음). 계정 메뉴의
 * [친구]로 연다. 기본 탭은 피드. 알림(친구 요청)은 `?tab=requests`, 내 블로그의 친구 수는 `?tab=friends`로 연다.
 *
 * 로그인 전용: 비로그인이면 `/login?returnTo=…`로 보낸다(서버도 401 — 화면만 막지 않는다).
 */
export default function FriendsPage() {
  const { loading, me } = useSession();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const tab = parseTab(params.get('tab'));

  if (loading) {
    return <main data-route="friends" aria-busy="true" className="friends-page" />;
  }
  if (!me) {
    return <Navigate to={loginPathFor(location.pathname + location.search)} replace />;
  }
  return (
    <main data-route="friends" className="friends-page">
      <h1>친구 관리</h1>
      <div className="friends-tabs" role="tablist" aria-label="친구 관리">
        {TABS.map(({ tab: value, label }) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`friends-tab-${value}`}
            aria-selected={value === tab}
            aria-controls="friends-panel"
            tabIndex={value === tab ? 0 : -1}
            onClick={() => setParams(value === 'feed' ? {} : { tab: value }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="friends-panel" role="tabpanel" aria-labelledby={`friends-tab-${tab}`}>
        {tab === 'feed' ? <FeedList /> : tab === 'requests' ? <FriendRequests /> : <MyFriends />}
      </div>
    </main>
  );
}
