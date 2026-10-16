import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as nestApi from '../../../api/nest';
import BlogAvatar from '../BlogAvatar';
import NestOnBlogSetting from '../NestOnBlogSetting';
import { look } from './nestFixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('둥지 프로필 사진 → 새 뒤집기 (021, 2026-10-16)', () => {
  it('주인이 켜 두었으면 사진을 누를 때마다 새 그림과 사진이 바뀐다', async () => {
    vi.spyOn(nestApi, 'getMemberNest').mockResolvedValue({
      ...look({ level: 2 }),
      showOnBlog: true,
    });
    render(<BlogAvatar handle="minseo" nickname="나민서" profileImageUrl="/p.png" />);
    const flip = await screen.findByRole('button', { name: '나민서 님의 새 보기' });
    expect(flip).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('blog-avatar')).toHaveAttribute('src', '/p.png');

    await userEvent.click(flip);
    expect(flip).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('blog-bird')).toContainElement(screen.getByTestId('nest-bird'));
    expect(screen.queryByTestId('blog-avatar')).toBeNull();

    await userEvent.click(flip);
    expect(screen.getByTestId('blog-avatar')).toBeInTheDocument();
  });

  it('기본(꺼짐)이거나 못 불러오면 누를 수 없는 그냥 사진이다', async () => {
    const get = vi
      .spyOn(nestApi, 'getMemberNest')
      .mockResolvedValue({ ...look(), showOnBlog: false });
    const { rerender } = render(<BlogAvatar handle="a" nickname="가" profileImageUrl="/a.png" />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('a'));
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByTestId('blog-avatar')).toBeInTheDocument();

    get.mockRejectedValue(new Error('down'));
    rerender(<BlogAvatar handle="b" nickname="나" profileImageUrl={null} />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('b'));
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('설정 > 프로필 "내 둥지에 새 보이기" 스위치', () => {
  function myNest(showOnBlog: boolean) {
    return { nest: { ...look(), showOnBlog } } as unknown as nestApi.MyNest;
  }

  it('처음엔 꺼져 있고 누르면 바로 켜서 저장한다', async () => {
    vi.spyOn(nestApi, 'getMyNest').mockResolvedValue(myNest(false));
    const save = vi.spyOn(nestApi, 'setNestShowOnBlog').mockResolvedValue(myNest(true));
    render(<NestOnBlogSetting />);
    const toggle = await screen.findByRole('switch', { name: '내 둥지에 새 보이기' });
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'false');

    await userEvent.click(toggle);
    expect(save).toHaveBeenCalledWith(true);
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));
  });

  it('저장에 실패하면 되돌리고 알린다', async () => {
    vi.spyOn(nestApi, 'getMyNest').mockResolvedValue(myNest(true));
    vi.spyOn(nestApi, 'setNestShowOnBlog').mockRejectedValue(new Error('down'));
    render(<NestOnBlogSetting />);
    const toggle = await screen.findByRole('switch', { name: '내 둥지에 새 보이기' });
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));

    await userEvent.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent('바꾸지 못했어요');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('처음 값을 못 불러오면 꺼짐으로 보이지 않고 스위치를 막는다', async () => {
    vi.spyOn(nestApi, 'getMyNest').mockRejectedValue(new Error('down'));
    render(<NestOnBlogSetting />);
    expect(await screen.findByText(/불러오지 못했어요/)).toBeInTheDocument();
    expect(screen.getByRole('switch', { name: '내 둥지에 새 보이기' })).toBeDisabled();
  });

  it('저장하는 동안에는 다시 누를 수 없다', async () => {
    vi.spyOn(nestApi, 'getMyNest').mockResolvedValue(myNest(false));
    let finish: (value: nestApi.MyNest) => void = () => {};
    const save = vi
      .spyOn(nestApi, 'setNestShowOnBlog')
      .mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<NestOnBlogSetting />);
    const toggle = await screen.findByRole('switch', { name: '내 둥지에 새 보이기' });
    await waitFor(() => expect(toggle).toBeEnabled());

    await userEvent.click(toggle);
    expect(toggle).toBeDisabled();
    await userEvent.click(toggle);
    expect(save).toHaveBeenCalledTimes(1);

    finish(myNest(true));
    await waitFor(() => expect(toggle).toBeEnabled());
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
