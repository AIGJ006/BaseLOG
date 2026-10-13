import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeSummary } from '../../api/me';
import { resetClientForTests } from '../../api/client';
import { SessionContext } from '../../features/auth/sessionContext';
import { attendance, look, myNest } from '../../features/nest/__tests__/nestFixtures';
import { ME, errorBody, json, requestsTo, stubFetch } from '../../test/fetchRoutes';
import NestPage from '../NestPage';

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderPage(loggedIn = true) {
  const session = {
    loading: false,
    me: loggedIn ? ({ ...ME, emailVerified: true } as MeSummary) : null,
    refresh: async () => null,
  };
  return render(
    <MemoryRouter initialEntries={['/nest']}>
      <SessionContext.Provider value={session}>
        <Where />
        <Routes>
          <Route path="/nest" element={<NestPage />} />
          <Route path="*" element={null} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}

const EMPTY_HISTORY = { items: [], nextBefore: null };

describe('NestPage 내 둥지 꾸미기 (021)', () => {
  beforeEach(() => resetClientForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('비로그인은 로그인 화면으로 보낸다', async () => {
    const mock = stubFetch({});
    renderPage(false);
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/login?returnTo=%2Fnest'),
    );
    expect(mock).not.toHaveBeenCalled();
  });

  it('들어오면 출석하고 잔액·크기·오늘 포인트·기록을 보인다', async () => {
    stubFetch({
      'POST /api/me/nest/attendance': () => json(200, attendance(myNest({ balance: 210 }))),
      'GET /api/me/nest/points': () =>
        json(200, {
          items: [
            {
              id: 3,
              reason: 'ATTENDANCE',
              label: '출석',
              amount: 10,
              createdAt: '2026-10-13T00:00:00Z',
            },
          ],
          nextBefore: null,
        }),
    });
    renderPage();
    expect(await screen.findByTestId('nest-balance')).toHaveTextContent('210점');
    expect(screen.getByText('출석했어요 +10')).toBeInTheDocument();
    expect(screen.getByText('2일 더 출석')).toBeInTheDocument();
    expect(screen.getByTestId('nest-today')).toHaveTextContent(
      '글 등록 1/3 · 댓글 0/5 · 받은 좋아요 2/20',
    );
    expect(await screen.findByText('+10')).toBeInTheDocument();
  });

  it('사기는 확인 뒤에 하고, 모자라면 버튼이 막힌다', async () => {
    const user = userEvent.setup();
    const after = myNest({ balance: 50 }, ['bg-sunset']);
    const mock = stubFetch({
      'POST /api/me/nest/attendance': () => json(200, attendance(myNest(), false, 0)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
      'POST /api/me/nest/items/bg-sunset': () => json(200, after),
    });
    renderPage();
    const night = await screen.findByTestId('nest-item-bg-night');
    expect(within(night).getByRole('button', { name: '50점 모자라요' })).toBeDisabled();

    const sunset = screen.getByTestId('nest-item-bg-sunset');
    await user.click(within(sunset).getByRole('button', { name: '사기' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: '사기' }));
    await waitFor(() =>
      expect(requestsTo(mock, 'POST', '/api/me/nest/items/bg-sunset')).toHaveLength(1),
    );
    expect(await screen.findByTestId('nest-balance')).toHaveTextContent('50점');
    expect(
      within(screen.getByTestId('nest-item-bg-sunset')).getByRole('button', { name: '장착' }),
    ).toBeEnabled();
  });

  it('장착은 지금 모습에 그 물건만 바꿔 보내고, 같은 자리 새 장식은 바꿔 단다', async () => {
    const user = userEvent.setup();
    const owned = ['prop-stone', 'acc-hat', 'acc-crown'];
    const current = myNest({ nest: look({ decorations: ['prop-stone', 'acc-hat'] }) }, owned);
    const mock = stubFetch({
      'POST /api/me/nest/attendance': () => json(200, attendance(current, false, 0)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
      'PUT /api/me/nest/equipped': () =>
        json(200, myNest({ nest: look({ decorations: ['prop-stone', 'acc-crown'] }) }, owned)),
    });
    renderPage();
    await user.click(await screen.findByRole('tab', { name: '새 장식' }));
    await user.click(
      within(screen.getByTestId('nest-item-acc-crown')).getByRole('button', { name: '장착' }),
    );
    await waitFor(() => expect(requestsTo(mock, 'PUT', '/api/me/nest/equipped')).toHaveLength(1));
    const [, init] = requestsTo(mock, 'PUT', '/api/me/nest/equipped')[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      background: 'bg-basic',
      nestType: 'nest-basic',
      decorations: ['prop-stone', 'acc-crown'],
    });
    expect(
      await within(screen.getByTestId('nest-item-acc-crown')).findByRole('button', {
        name: '내리기',
      }),
    ).toBeInTheDocument();
  });

  it('서버가 거절하면 이유를 보인다', async () => {
    const user = userEvent.setup();
    stubFetch({
      'POST /api/me/nest/attendance': () =>
        json(200, attendance(myNest({}, ['acc-heart']), false, 0)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
      'PUT /api/me/nest/equipped': () =>
        json(400, errorBody('NEST_ITEM_NOT_OWNED', '가진 물건만 장착할 수 있어요')),
    });
    renderPage();
    await user.click(await screen.findByRole('tab', { name: '새 장식' }));
    await user.click(
      within(screen.getByTestId('nest-item-acc-heart')).getByRole('button', { name: '장착' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('가진 물건만 장착할 수 있어요');
  });
});
