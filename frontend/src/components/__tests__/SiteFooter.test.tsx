import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import SiteFooter from '../SiteFooter';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SiteFooter />
    </MemoryRouter>,
  );
}

describe('SiteFooter', () => {
  it('GitHub Organization 링크를 새 탭으로 연다', () => {
    renderAt('/');

    const link = screen.getByRole('link', { name: 'BaseLOG GitHub (새 탭)' });
    expect(link).toHaveAttribute('href', 'https://github.com/AIGJ006');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('이용약관 화면으로 가는 링크가 있다', () => {
    renderAt('/');

    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
  });

  it('글쓰기 화면에는 꼬리말이 없다', () => {
    renderAt('/write/new');

    expect(screen.queryByRole('contentinfo')).toBeNull();
  });
});
