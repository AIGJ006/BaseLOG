import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as nestApi from '../../../api/nest';
import BlogAvatar from '../BlogAvatar';
import { look } from './nestFixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('둥지 프로필 사진 → 새 뒤집기 (021, 2026-10-16)', () => {
  it('사진을 누를 때마다 그 사람의 새 그림과 사진이 바뀐다', async () => {
    vi.spyOn(nestApi, 'getMemberNest').mockResolvedValue(look({ level: 2 }));
    render(<BlogAvatar handle="minseo" nickname="나민서" profileImageUrl="/p.png" />);
    const flip = screen.getByRole('button', { name: '나민서 님의 새 보기' });
    expect(flip).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('blog-avatar')).toHaveAttribute('src', '/p.png');

    await userEvent.click(flip);
    expect(flip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('blog-bird')).toContainElement(screen.getByTestId('nest-bird'));
    expect(screen.getByTestId('nest-scene')).toHaveAttribute('data-level', '2');
    expect(screen.queryByTestId('blog-avatar')).toBeNull();

    await userEvent.click(flip);
    expect(screen.getByTestId('blog-avatar')).toBeInTheDocument();
  });

  it('둥지 모습을 못 불러와도 1단계 기본 새로 뒤집힌다', async () => {
    const get = vi.spyOn(nestApi, 'getMemberNest').mockRejectedValue(new Error('down'));
    render(<BlogAvatar handle="b" nickname="나" profileImageUrl={null} />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('b'));
    expect(screen.getByTestId('default-avatar')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '나 님의 새 보기' }));
    expect(screen.getByTestId('nest-scene')).toHaveAttribute('data-level', '1');
  });
});
