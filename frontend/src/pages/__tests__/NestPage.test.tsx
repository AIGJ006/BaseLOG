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

describe('NestPage 새 키우기 (021)', () => {
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

  it('제목은 새 키우기이고, 꾸미기와 포인트 기록이 같은 화면에 있다', async () => {
    stubFetch({
      'POST /api/me/nest/attendance': () =>
        json(200, attendance(myNest({ nest: look({ nestType: 'nest-star' }) }), true, 10, true)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
    });
    renderPage();
    expect(await screen.findByRole('heading', { name: '새 키우기' })).toBeInTheDocument();
    expect(screen.getByText('출석했어요 +10 · 새가 꼬마 새로 자랐어요')).toBeInTheDocument();
    expect(screen.getAllByTestId('nest-type')[0]).toHaveAttribute('data-code', 'nest-star');
    expect(screen.getByRole('heading', { name: '꾸미기' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '포인트 기록' })).toBeInTheDocument();
    expect(screen.queryByText('상점')).toBeNull();
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

  it('잠긴 물건은 해금 한 번에 포인트를 쓰고 바로 씌우고, 모자라면 버튼이 막힌다', async () => {
    const user = userEvent.setup();
    const bought = myNest({ balance: 50 }, ['bg-sunset']);
    const worn = myNest({ balance: 50, nest: look({ background: 'bg-sunset' }) }, ['bg-sunset']);
    const mock = stubFetch({
      'POST /api/me/nest/attendance': () => json(200, attendance(myNest(), false, 0)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
      'POST /api/me/nest/items/bg-sunset': () => json(200, bought),
      'PUT /api/me/nest/equipped': () => json(200, worn),
    });
    renderPage();
    const night = await screen.findByTestId('nest-item-bg-night');
    expect(within(night).getByRole('button', { name: '🔒 50점 모자라요' })).toBeDisabled();

    const sunset = screen.getByTestId('nest-item-bg-sunset');
    await user.click(within(sunset).getByRole('button', { name: '🔒 150점으로 해금' }));
    await waitFor(() => expect(requestsTo(mock, 'PUT', '/api/me/nest/equipped')).toHaveLength(1));
    expect(requestsTo(mock, 'POST', '/api/me/nest/items/bg-sunset')).toHaveLength(1);
    const [, init] = requestsTo(mock, 'PUT', '/api/me/nest/equipped')[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      background: 'bg-sunset',
      nestType: 'nest-basic',
      decorations: [],
    });
    expect(await screen.findByText("'노을' 해금했어요")).toBeInTheDocument();
    expect(screen.getByTestId('nest-balance')).toHaveTextContent('50점');
  });

  it('장착은 지금 모습에 그 물건만 바꿔 보내고, 같은 자리 새 장식은 바꿔 단다', async () => {
    const user = userEvent.setup();
    const owned = ['acc-flower-pin', 'acc-ribbon', 'acc-crown'];
    const current = myNest(
      { nest: look({ decorations: ['acc-flower-pin', 'acc-ribbon'] }) },
      owned,
    );
    const mock = stubFetch({
      'POST /api/me/nest/attendance': () => json(200, attendance(current, false, 0)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
      'PUT /api/me/nest/equipped': () =>
        json(200, myNest({ nest: look({ decorations: ['acc-flower-pin', 'acc-crown'] }) }, owned)),
    });
    renderPage();
    await user.click(await screen.findByRole('tab', { name: '새 장식' }));
    await user.click(
      within(screen.getByTestId('nest-item-acc-crown')).getByRole('button', { name: '착용' }),
    );
    await waitFor(() => expect(requestsTo(mock, 'PUT', '/api/me/nest/equipped')).toHaveLength(1));
    const [, init] = requestsTo(mock, 'PUT', '/api/me/nest/equipped')[0];
    expect(JSON.parse(String(init?.body))).toEqual({
      background: 'bg-basic',
      nestType: 'nest-basic',
      decorations: ['acc-flower-pin', 'acc-crown'],
    });
    expect(
      await within(screen.getByTestId('nest-item-acc-crown')).findByRole('button', {
        name: '착용 해제',
      }),
    ).toBeInTheDocument();
  });

  it('서버가 거절하면 이유를 보인다', async () => {
    const user = userEvent.setup();
    stubFetch({
      'POST /api/me/nest/attendance': () =>
        json(200, attendance(myNest({}, ['acc-flower-pin']), false, 0)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
      'PUT /api/me/nest/equipped': () =>
        json(400, errorBody('NEST_ITEM_NOT_OWNED', '가진 물건만 장착할 수 있어요')),
    });
    renderPage();
    await user.click(await screen.findByRole('tab', { name: '새 장식' }));
    await user.click(
      within(screen.getByTestId('nest-item-acc-flower-pin')).getByRole('button', { name: '착용' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('가진 물건만 장착할 수 있어요');
  });

  it('시험용 칸은 서버가 켰을 때만 보이고, 새 단계와 포인트를 바로 바꾼다', async () => {
    const user = userEvent.setup();
    const mock = stubFetch({
      'POST /api/me/nest/attendance': () =>
        json(200, attendance(myNest({ devTools: true }), false, 0)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
      'PUT /api/me/nest/dev/level': () =>
        json(200, myNest({ devTools: true, nest: look({ level: 4, levelName: '어른 새' }) })),
      'POST /api/me/nest/dev/points': () => json(200, myNest({ devTools: true, balance: 1200 })),
    });
    renderPage();
    const dev = await screen.findByTestId('nest-dev');
    await user.click(within(dev).getByRole('button', { name: '4단계' }));
    await waitFor(() => expect(requestsTo(mock, 'PUT', '/api/me/nest/dev/level')).toHaveLength(1));
    expect(
      JSON.parse(String(requestsTo(mock, 'PUT', '/api/me/nest/dev/level')[0][1]?.body)),
    ).toEqual({
      level: 4,
    });
    expect(await within(dev).findByRole('button', { name: '4단계' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await user.click(within(dev).getByRole('button', { name: '+1,000점' }));
    expect(await screen.findByTestId('nest-balance')).toHaveTextContent('1,200점');
  });

  it('운영처럼 서버가 끄면 시험용 칸이 없다', async () => {
    stubFetch({
      'POST /api/me/nest/attendance': () => json(200, attendance(myNest(), false, 0)),
      'GET /api/me/nest/points': () => json(200, EMPTY_HISTORY),
    });
    renderPage();
    await screen.findByTestId('nest-balance');
    expect(screen.queryByTestId('nest-dev')).toBeNull();
  });
});
