import { render, screen, waitFor, within } from '@testing-library/react';
import type { MeSummary } from '../../api/me';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../api/client';
import type { FeedPage as Page } from '../../api/feed';
import type { PostCard } from '../../api/types/reading';
import { SessionContext } from '../../features/auth/sessionContext';
import { FRIEND_MESSAGES } from '../../features/friends/friendMessages';
import { ME, errorBody, json, requestsTo, stubFetch } from '../../test/fetchRoutes';
import * as listRestore from '../../features/post-list/listRestore';
import { FEED_LIST_KEY } from '../../features/friends/FeedList';
import FriendsPage from '../FriendsPage';
import SettingsPage from '../SettingsPage';

function card(id: number): PostCard {
  return {
    id,
    url: `/@na_ms/posts/${id}`,
    title: `글 ${id}`,
    excerpt: '요약',
    thumbnailUrl: null,
    firstPublicAt: '2026-10-02T14:03:12.123456Z',
    commentCount: 0,
    likeCount: 0,
    author: { handle: 'na_ms', nickname: '나민서', profileImageUrl: null },
  };
}

function page(ids: number[], nextCursor: string | null, hasFriends = true): Page {
  return { items: ids.map(card), nextCursor, hasFriends };
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderFeed({ loggedIn = true, path = '/friends' } = {}) {
  const session = {
    loading: false,
    me: loggedIn ? ({ ...ME, emailVerified: true } as MeSummary) : null,
    refresh: async () => null,
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionContext.Provider value={session}>
        <Where />
        <Routes>
          <Route path="/friends" element={<FriendsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={null} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}

/** 친구 화면의 피드 탭 (010 T026, US2, FR-017~022). */
describe('FriendsPage 피드', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetClientForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('비로그인은 /login?returnTo=%2Ffriends 로 보낸다 (피드 요청 없음)', async () => {
    const fetchMock = stubFetch({});
    renderFeed({ loggedIn: false });
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/login?returnTo=%2Ffriends'),
    );
    expect(requestsTo(fetchMock, 'GET', '/api/feed')).toHaveLength(0);
  });

  it('친구의 카드를 작성자와 함께 보여 주고 [더 보기]로 이어 붙인다', async () => {
    let call = 0;
    const pages = [page([9, 8, 7, 6, 5, 4, 3, 2, 1], 'c1'), page([0], null)];
    const fetchMock = stubFetch({ 'GET /api/feed': () => json(200, pages[call++]) });
    renderFeed();

    await waitFor(() => expect(screen.getAllByTestId('post-card')).toHaveLength(9));
    expect(screen.getAllByText('나민서').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: '더 보기' }));
    await waitFor(() => expect(screen.getAllByTestId('post-card')).toHaveLength(10));
    const calls = requestsTo(fetchMock, 'GET', '/api/feed');
    expect(String(calls[0][0])).toBe('/api/feed');
    expect(String(calls[1][0])).toContain('cursor=c1');
  });

  it('친구가 없으면 친구 요청을 보내 보라고 홈으로 안내한다', async () => {
    stubFetch({ 'GET /api/feed': () => json(200, page([], null, false)) });
    renderFeed();
    const empty = await screen.findByTestId('empty-feed');
    expect(empty).toHaveTextContent(FRIEND_MESSAGES.feedNoFriends);
    expect(screen.getByRole('link', { name: '홈' })).toHaveAttribute('href', '/');
  });

  it('친구는 있지만 공개 글이 없으면 다른 문구', async () => {
    stubFetch({ 'GET /api/feed': () => json(200, page([], null, true)) });
    renderFeed();
    const empty = await screen.findByTestId('empty-feed');
    expect(empty).toHaveTextContent(FRIEND_MESSAGES.feedNoPosts);
    expect(screen.queryByRole('link', { name: '홈' })).toBeNull();
  });

  it("뒤로 가기(POP)로 돌아오면 'feed' 보관값으로 요청 없이 복원한다", async () => {
    window.scrollTo = vi.fn();
    listRestore.save(FEED_LIST_KEY, { items: [card(5), card(4)], nextCursor: 'c9', scrollY: 0 });
    const fetchMock = stubFetch({ 'GET /api/feed': () => json(200, page([1], null)) });
    renderFeed();
    await waitFor(() => expect(screen.getAllByTestId('post-card')).toHaveLength(2));
    expect(requestsTo(fetchMock, 'GET', '/api/feed')).toHaveLength(0);
  });

  it('첫 목록이 실패하면 [다시 시도]', async () => {
    let fail = true;
    stubFetch({
      'GET /api/feed': () =>
        fail
          ? json(500, { code: 'INTERNAL', message: 'x', errors: [], details: null })
          : json(200, page([1], null)),
    });
    renderFeed();
    const retry = await screen.findByRole('button', { name: '다시 시도' });
    fail = false;
    await userEvent.click(retry);
    await waitFor(() => expect(screen.getAllByTestId('post-card')).toHaveLength(1));
  });
});

const EMPTY = { items: [], nextCursor: null };

/** 친구 화면의 탭과 받은 요청·내 친구 (2026-10-13 설정에서 옮김, FR-055·056). */
describe('FriendsPage 탭', () => {
  beforeEach(() => {
    sessionStorage.clear();
    resetClientForTests();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('기본 탭은 피드이고, 탭을 누르면 ?tab= 주소가 바뀐다', async () => {
    stubFetch({
      'GET /api/feed': () => json(200, page([1], null)),
      'GET /api/me/friend-requests': () => json(200, EMPTY),
      'GET /api/me/friends': () => json(200, EMPTY),
    });
    const user = userEvent.setup();
    renderFeed();
    expect(screen.getByRole('heading', { level: 1, name: '친구' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '피드' })).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(screen.getAllByTestId('post-card')).toHaveLength(1));

    await user.click(screen.getByRole('tab', { name: '받은 요청' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/friends?tab=requests');
    expect(await screen.findByText('받은 요청이 없어요')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '내 친구' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/friends?tab=friends');
    expect(await screen.findByText('아직 친구가 없어요')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: '피드' }));
    expect(screen.getByTestId('where')).toHaveTextContent(/^\/friends$/);
  });

  it('옛 주소 /settings#friends는 받은 요청 탭으로 보낸다', async () => {
    stubFetch({ 'GET /api/me/friend-requests': () => json(200, EMPTY) });
    renderFeed({ path: '/settings#friends' });
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/friends?tab=requests'),
    );
    expect(screen.getByRole('tab', { name: '받은 요청' })).toHaveAttribute('aria-selected', 'true');
  });

  it('받은 친구 요청 [수락]·[거절]', async () => {
    const mock = stubFetch({
      'GET /api/me/friend-requests': () =>
        json(200, {
          items: [
            {
              handle: 'carol',
              nickname: '캐롤',
              profileImageUrl: null,
              requestedAt: '2026-10-01T00:00:00Z',
            },
            {
              handle: 'dave',
              nickname: '데이브',
              profileImageUrl: null,
              requestedAt: '2026-09-30T00:00:00Z',
            },
          ],
          nextCursor: null,
        }),
      'PUT /api/members/carol/friend': () => json(200, { status: 'FRIENDS' }),
      'DELETE /api/members/dave/friend': () => json(200, { status: 'NONE' }),
    });
    const user = userEvent.setup();
    renderFeed({ path: '/friends?tab=requests' });
    const requests = await screen.findByRole('region', { name: '받은 친구 요청' });
    expect(await within(requests).findByText('캐롤')).toBeInTheDocument();
    expect(within(requests).getByText('@carol')).toBeInTheDocument();

    await user.click(within(requests).getAllByRole('button', { name: '수락' })[0]);
    await waitFor(() => expect(within(requests).queryByText('캐롤')).not.toBeInTheDocument());
    expect(requestsTo(mock, 'PUT', '/api/members/carol/friend')).toHaveLength(1);

    await user.click(within(requests).getByRole('button', { name: '거절' }));
    await waitFor(() => expect(within(requests).queryByText('데이브')).not.toBeInTheDocument());
    expect(within(requests).getByText('받은 요청이 없어요')).toBeInTheDocument();
  });

  it('내 친구: 사진·최근 활동, [친구 끊기]는 확인 후', async () => {
    const mock = stubFetch({
      'GET /api/me/friends': () =>
        json(200, {
          items: [
            {
              handle: 'bob',
              nickname: '밥밥이',
              profileImageUrl: 'https://img.example/bob.webp',
              friendsSince: '2026-09-01T00:00:00Z',
              lastActive: { bucket: 'DAYS_AGO', days: 3 },
            },
          ],
          nextCursor: null,
        }),
      'DELETE /api/members/bob/friend': () => json(200, { status: 'NONE' }),
    });
    const user = userEvent.setup();
    renderFeed({ path: '/friends?tab=friends' });
    const friends = await screen.findByRole('region', { name: '내 친구' });
    expect(await within(friends).findByText('밥밥이')).toBeInTheDocument();
    expect(friends.querySelector('img')).toHaveAttribute('src', 'https://img.example/bob.webp');
    expect(within(friends).getByText('최근 활동 3일 전')).toBeInTheDocument();

    await user.click(within(friends).getByRole('button', { name: '친구 끊기' }));
    await user.click(await screen.findByRole('button', { name: '끊기' }));
    await waitFor(() => expect(within(friends).queryByText('밥밥이')).not.toBeInTheDocument());
    expect(requestsTo(mock, 'DELETE', '/api/members/bob/friend')).toHaveLength(1);
  });

  it('[더 보기]로 다음 페이지를 붙이고 같은 사람은 한 번만', async () => {
    const f1 = {
      handle: 'f1',
      nickname: '친구일',
      profileImageUrl: null,
      friendsSince: '2026-09-02T00:00:00Z',
    };
    const f2 = {
      handle: 'f2',
      nickname: '친구이',
      profileImageUrl: null,
      friendsSince: '2026-09-01T00:00:00Z',
    };
    const mock = stubFetch({});
    mock.mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.split('?')[0] === '/api/me/friends') {
        return json(
          200,
          url.includes('cursor=c1')
            ? { items: [f1, f2], nextCursor: null }
            : { items: [f1], nextCursor: 'c1' },
        );
      }
      return json(404, errorBody('NOT_FOUND', String(init?.method)));
    });
    const user = userEvent.setup();
    renderFeed({ path: '/friends?tab=friends' });
    const friends = await screen.findByRole('region', { name: '내 친구' });
    await within(friends).findByText('친구일');
    await user.click(within(friends).getByRole('button', { name: '더 보기' }));
    expect(await within(friends).findByText('친구이')).toBeInTheDocument();
    expect(within(friends).getAllByText('친구일')).toHaveLength(1);
    expect(within(friends).queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
  });
});
