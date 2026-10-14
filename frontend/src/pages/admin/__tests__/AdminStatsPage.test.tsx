import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../../api/client';
import type { AdminStats } from '../../../api/stats';
import { json, stubFetch } from '../../../test/fetchRoutes';
import AdminStatsPage from '../AdminStatsPage';

function stats(overrides: Partial<AdminStats> = {}): AdminStats {
  const daily = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 8, 15 + i));
    return {
      date: d.toISOString().slice(0, 10),
      visitors: i,
      memberVisitors: Math.floor(i / 2),
      views: i * 3,
    };
  });
  return {
    today: '2026-10-14',
    visitors: {
      today: 29,
      yesterday: 28,
      last7Days: 182,
      last30Days: 435,
      total: 1435,
      since: '2026-09-01',
    },
    daily,
    members: { total: 12, today: 1, last7Days: 4 },
    posts: { total: 40, today: 2, last7Days: 9 },
    comments: { total: 88, today: 0, last7Days: 11 },
    views: { today: 87, last7Days: 500, total: 9000 },
    topPosts: [{ postId: 7, title: '첫 글', handle: 'writer01', views: 42 }],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/admin/stats']}>
      <AdminStatsPage />
    </MemoryRouter>,
  );
}

describe('AdminStatsPage', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('방문자 칸·활동 표·많이 본 글을 보여 준다', async () => {
    stubFetch({ 'GET /api/admin/stats': () => json(200, stats()) });
    renderPage();

    expect(within(await screen.findByTestId('tile-오늘')).getByText('29')).toBeInTheDocument();
    expect(within(screen.getByTestId('tile-누적')).getByText('1,435')).toBeInTheDocument();
    expect(within(screen.getByTestId('tile-누적')).getByText('9/1부터')).toBeInTheDocument();
    const row = screen.getByRole('row', { name: /새 댓글/ });
    expect(within(row).getByText('88')).toBeInTheDocument();
    const link = within(screen.getByTestId('top-posts')).getByRole('link', { name: '첫 글' });
    expect(link).toHaveAttribute('href', '/@writer01/posts/7');
  });

  it('그래프 항목을 글 조회수로 바꾸면 합계도 바뀐다', async () => {
    stubFetch({ 'GET /api/admin/stats': () => json(200, stats()) });
    renderPage();

    expect(await screen.findByText('30일 합계 435')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '글 조회수' }));
    expect(screen.getByText('30일 합계 1,305')).toBeInTheDocument();
  });

  it('많이 본 글이 없으면 안내한다', async () => {
    stubFetch({ 'GET /api/admin/stats': () => json(200, stats({ topPosts: [] })) });
    renderPage();
    expect(await screen.findByText('아직 조회된 글이 없어요')).toBeInTheDocument();
  });
});
