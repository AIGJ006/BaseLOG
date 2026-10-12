import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

/** 홈 오른쪽 칸 (요즘 인기 태그 + 인기 태그 글) */
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
    const tagList = box.querySelector('.home-sidebar-tags') as HTMLElement;
    const links = within(tagList).getAllByRole('link');
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/tags/spring',
      `/tags/${encodeURIComponent('자바')}`,
    ]);
    expect(links[0]).toHaveTextContent('#spring 글 3개');
    expect(within(box).getByRole('link', { name: '태그 전체 보기' })).toHaveAttribute(
      'href',
      '/tags',
    );
  });

  it('1위 태그 글 3개를 보이고 ›로 다음 태그 글로 넘긴다', async () => {
    const card = (id: number, title: string) => ({
      id,
      url: `/@kim/posts/${id}`,
      title,
      excerpt: null,
      thumbnailUrl: null,
      firstPublicAt: '2026-10-12T00:00:00.000000Z',
      commentCount: 0,
      likeCount: 0,
      author: { handle: 'kim', nickname: '김민서', profileImageUrl: null },
    });
    stubFetch({
      'GET /api/tags/trending': () =>
        json(200, {
          items: [
            { name: '개발', postCount: 4 },
            { name: '일상', postCount: 1 },
          ],
        }),
      [`GET /api/tags/${encodeURIComponent('개발')}/posts`]: () =>
        json(200, {
          items: [card(1, '첫 글'), card(2, '둘째 글'), card(3, '셋째 글'), card(4, '넷째 글')],
          nextCursor: null,
        }),
      [`GET /api/tags/${encodeURIComponent('일상')}/posts`]: () =>
        json(200, { items: [card(9, '카페 다녀옴')], nextCursor: null }),
    });
    renderSidebar();

    expect(await screen.findByRole('heading', { name: '#개발' })).toBeInTheDocument();
    expect((await screen.findByText('첫 글')).closest('a')).toHaveAttribute(
      'href',
      '/@kim/posts/1',
    );
    expect(screen.getByText('셋째 글')).toBeInTheDocument();
    expect(screen.queryByText('넷째 글')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '다음 태그' }));
    expect(await screen.findByRole('heading', { name: '#일상' })).toBeInTheDocument();
    expect(await screen.findByText('카페 다녀옴')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '이전 태그' }));
    expect(await screen.findByRole('heading', { name: '#개발' })).toBeInTheDocument();
  });

  it('태그를 못 불러오면 그 묶음을 감춘다', async () => {
    const mock = stubFetch({
      'GET /api/tags/trending': () => json(500, errorBody('INTERNAL_ERROR', '오류')),
    });
    renderSidebar();

    await waitFor(() => expect(mock).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: '요즘 인기 태그' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '글 쓰러 가기' })).not.toBeInTheDocument();
  });
});
