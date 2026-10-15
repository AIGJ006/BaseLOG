import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../api/client';
import type { MeSummary } from '../api/me';
import type { MyStats } from '../api/stats';
import { SessionContext } from '../features/auth/sessionContext';
import { ME, json, stubFetch } from '../test/fetchRoutes';
import ManageStatsPage from './ManageStatsPage';

function stats(overrides: Partial<MyStats> = {}): MyStats {
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 16 + i));
    return { date: d.toISOString().slice(0, 10), views: i * 2, likes: i % 3, comments: i % 2 };
  });
  return {
    today: '2026-10-15',
    views: { today: 58, last7Days: 350, last30Days: 870, total: 4321 },
    daily,
    posts: { total: 24, today: 1, last7Days: 3 },
    likes: { total: 120, today: 2, last7Days: 9 },
    comments: { total: 45, today: 0, last7Days: 5 },
    topPosts: [
      { postId: 7, title: '첫 글', visibility: 'PUBLIC', views: 42 },
      { postId: 9, title: '비밀 일기', visibility: 'PRIVATE', views: 5 },
    ],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <SessionContext.Provider
      value={{ loading: false, me: ME as MeSummary, refresh: async () => null }}
    >
      <MemoryRouter initialEntries={['/manage/stats']}>
        <ManageStatsPage />
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}

describe('ManageStatsPage 내 둥지 통계', () => {
  beforeEach(() => resetClientForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('조회수 칸·활동 표·많이 본 글을 보여 준다', async () => {
    stubFetch({ 'GET /api/me/stats': () => json(200, stats()) });
    renderPage();

    expect(within(await screen.findByTestId('my-tile-오늘')).getByText('58')).toBeInTheDocument();
    expect(within(screen.getByTestId('my-tile-누적')).getByText('4,321')).toBeInTheDocument();
    expect(screen.getByText('2026년 10월 15일 기준')).toBeInTheDocument();
    const likes = screen.getByRole('row', { name: /받은 좋아요/ });
    expect(
      within(likes)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['2', '9', '120']);
    const top = screen.getByTestId('my-top-posts');
    expect(within(top).getByRole('link', { name: '첫 글' })).toHaveAttribute(
      'href',
      `/@${ME.handle}/posts/7`,
    );
    expect(within(top).getByText('비밀 일기')).toBeInTheDocument();
  });

  it('그래프 항목을 바꾸면 그 값으로 그린다', async () => {
    const user = userEvent.setup();
    stubFetch({ 'GET /api/me/stats': () => json(200, stats()) });
    renderPage();

    expect(await screen.findByText('조회수 58')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '받은 좋아요' }));
    expect(screen.getByRole('button', { name: '받은 좋아요' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('받은 좋아요 2')).toBeInTheDocument();
  });

  it('조회된 글이 없으면 안내하고, 못 불러오면 다시 시도할 수 있다', async () => {
    const user = userEvent.setup();
    let calls = 0;
    stubFetch({
      'GET /api/me/stats': () => {
        calls += 1;
        return calls === 1 ? json(500, { errors: [] }) : json(200, stats({ topPosts: [] }));
      },
    });
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('통계를 불러오지 못했어요');
    await user.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('아직 조회된 글이 없어요')).toBeInTheDocument();
  });
});
