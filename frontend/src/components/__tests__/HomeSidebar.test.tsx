import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorBody, json, stubFetch } from '../../test/fetchRoutes';
import HomeSidebar from '../HomeSidebar';

function renderSidebar() {
  return render(
    <MemoryRouter>
      <HomeSidebar />
    </MemoryRouter>,
  );
}

/** 홈 오른쪽 칸 (요즘 인기 태그 + 소개) */
describe('HomeSidebar', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('요즘 인기 태그를 받은 순서대로 태그 페이지 링크로 보인다', async () => {
    stubFetch({
      'GET /api/tags/trending': () =>
        json(200, {
          items: [
            { name: 'spring', postCount: 3 },
            { name: '자바', postCount: 1 },
          ],
        }),
    });
    renderSidebar();

    const box = (await screen.findByRole('heading', { name: '요즘 인기 태그' })).closest(
      'section',
    )!;
    const links = within(box).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/tags/spring',
      `/tags/${encodeURIComponent('자바')}`,
      '/tags',
    ]);
    expect(links[0]).toHaveTextContent('#spring 글 3개');
  });

  it('태그를 못 불러오면 그 묶음만 감추고 소개는 보인다', async () => {
    stubFetch({ 'GET /api/tags/trending': () => json(500, errorBody('INTERNAL_ERROR', '오류')) });
    renderSidebar();

    expect(await screen.findByRole('link', { name: '글 쓰러 가기' })).toHaveAttribute(
      'href',
      '/write/new',
    );
    expect(screen.queryByRole('heading', { name: '요즘 인기 태그' })).not.toBeInTheDocument();
  });
});
