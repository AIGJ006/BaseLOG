import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../../api/client';
import { json, stubFetch } from '../../../test/fetchRoutes';
import FriendLists from '../FriendLists';

const EMPTY = { items: [], nextCursor: null };

function renderAt(path: string) {
  stubFetch({
    'GET /api/me/friend-requests': () => json(200, EMPTY),
    'GET /api/me/friends': () => json(200, EMPTY),
  });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <FriendLists />
    </MemoryRouter>,
  );
}

/** 설정 화면 친구 영역의 `#friends` 조각 (알림·내 블로그 친구 수가 여는 곳). */
describe('FriendLists 조각', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    resetClientForTests();
    scrollIntoView.mockReset();
    Element.prototype.scrollIntoView = scrollIntoView;
  });
  afterEach(() => vi.unstubAllGlobals());

  it('영역에 id="friends"가 있고, 주소가 #friends면 그곳으로 스크롤한다', async () => {
    const { container } = renderAt('/settings#friends');
    expect(await screen.findByText('받은 요청이 없어요')).toBeInTheDocument();
    const anchor = container.querySelector('#friends');
    expect(anchor).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(anchor);
  });

  it('조각이 없으면 스크롤하지 않는다', async () => {
    renderAt('/settings');
    expect(await screen.findByText('받은 요청이 없어요')).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
