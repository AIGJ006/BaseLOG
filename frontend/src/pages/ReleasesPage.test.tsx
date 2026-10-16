import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import NoticesPage from './NoticesPage';
import ReleasesPage from './ReleasesPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/notices" element={<NoticesPage />} />
        <Route path="/notices/:id" element={<NoticesPage />} />
        <Route path="/releases" element={<ReleasesPage />} />
        <Route path="/releases/:id" element={<ReleasesPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('업데이트 소식·공지 화면', () => {
  it('업데이트 소식 목록은 제목 한 줄씩, 최신 버전이 맨 위이고 PR 번호를 보이지 않는다', () => {
    renderAt('/releases');
    expect(screen.getByRole('heading', { level: 1, name: '업데이트 소식' })).toBeInTheDocument();
    const rows = screen.getAllByRole('link');
    expect(rows[0]).toHaveAttribute('href', '/releases/v1.4.3');
    expect(rows[0]).toHaveTextContent('최신');
    expect(rows.at(-1)).toHaveAttribute('href', '/releases/v1.0.0');
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\(#\d+/);
  });

  it('줄을 누르면 그 글 화면으로 들어가고 [목록]으로 돌아온다', async () => {
    const user = userEvent.setup();
    renderAt('/releases');

    await user.click(screen.getByRole('link', { name: /BaseLOG 1.0 출시/ }));

    expect(screen.getByRole('article')).toHaveAttribute('id', 'v1.0.0');
    expect(screen.getByRole('heading', { level: 1, name: 'BaseLOG 1.0 출시' })).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\(#\d+/);

    await user.click(screen.getByRole('link', { name: '← 업데이트 소식 목록' }));
    expect(screen.getByRole('heading', { level: 1, name: '업데이트 소식' })).toBeInTheDocument();
  });

  it('예전 주소 /releases#v1.0.1은 그 글 화면으로, 없는 글은 안내', () => {
    renderAt('/releases#v1.0.1');
    expect(screen.getByRole('article')).toHaveAttribute('id', 'v1.0.1');

    renderAt('/releases/v9.9.9');
    expect(screen.getByText('찾는 글이 없어요')).toBeInTheDocument();
  });

  it('공지 목록에 첫 공지가 보이고 누르면 들어간다', async () => {
    const user = userEvent.setup();
    renderAt('/notices');
    await user.click(screen.getByRole('link', { name: /BaseLOG를 열었어요/ }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'BaseLOG를 열었어요' }),
    ).toBeInTheDocument();
  });
});
