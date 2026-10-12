import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NoticesPage from './NoticesPage';
import ReleasesPage from './ReleasesPage';

describe('업데이트 소식·공지 화면', () => {
  it('업데이트 소식은 최신 버전이 맨 위이고 PR 번호를 보이지 않는다', () => {
    render(
      <MemoryRouter>
        <ReleasesPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', { level: 1, name: '업데이트 소식' })).toBeInTheDocument();
    const articles = screen.getAllByRole('article');
    expect(articles[0]).toHaveAttribute('id', 'v1.0.1');
    expect(within(articles[0]).getByText('최신')).toBeInTheDocument();
    expect(articles.at(-1)).toHaveAttribute('id', 'v1.0.0');
    expect(screen.getByRole('heading', { level: 2, name: 'BaseLOG 1.0 출시' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\(#\d+/);
  });

  it('공지에 첫 공지가 보인다', () => {
    render(
      <MemoryRouter>
        <NoticesPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 2, name: 'BaseLOG를 열었어요' }),
    ).toBeInTheDocument();
  });
});
