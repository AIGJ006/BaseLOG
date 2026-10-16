import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as nestApi from '../../../api/nest';
import BlogNestFrame from '../BlogNestFrame';
import NestOnBlogSetting from '../NestOnBlogSetting';
import { look } from './nestFixtures';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('둥지 프로필 새 액자 (021, 2026-10-16)', () => {
  it('주인이 켜 두었을 때만 새 액자가 보인다', async () => {
    vi.spyOn(nestApi, 'getMemberNest').mockResolvedValue({
      ...look({ level: 2 }),
      showOnBlog: true,
    });
    render(<BlogNestFrame handle="minseo" nickname="나민서" />);
    expect(await screen.findByTestId('blog-bird')).toHaveAccessibleName('나민서 님의 새');
    expect(screen.getByTestId('nest-bird')).toHaveAttribute('data-stage', '2');
  });

  it('기본(꺼짐)이거나 못 불러오면 아무것도 그리지 않는다', async () => {
    const get = vi
      .spyOn(nestApi, 'getMemberNest')
      .mockResolvedValue({ ...look(), showOnBlog: false });
    const { container, rerender } = render(<BlogNestFrame handle="a" nickname="가" />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('a'));
    expect(container).toBeEmptyDOMElement();

    get.mockRejectedValue(new Error('down'));
    rerender(<BlogNestFrame handle="b" nickname="나" />);
    await waitFor(() => expect(get).toHaveBeenCalledWith('b'));
    expect(container).toBeEmptyDOMElement();
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
});
