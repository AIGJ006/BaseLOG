import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../../api/client';
import { json, requestsTo, stubFetch } from '../../../test/fetchRoutes';
import NestPanel from '../NestPanel';
import { attendance, look, myNest } from './nestFixtures';

describe('NestPanel (021 US3)', () => {
  beforeEach(() => resetClientForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('남의 둥지는 그 주인의 새를 보이고 출석하지 않는다', async () => {
    const mock = stubFetch({
      'GET /api/members/na_ms/nest': () => json(200, look({ levelName: '어른 새', level: 4 })),
    });
    render(
      <MemoryRouter>
        <NestPanel handle="na_ms" isMe={false} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('어른 새')).toBeInTheDocument();
    expect(screen.getByText(/연속 출석 4일/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '새 키우기' })).toBeNull();
    expect(requestsTo(mock, 'POST', '/api/me/nest/attendance')).toHaveLength(0);
  });

  it('내 둥지면 출석하고 처음이면 알림을 띄운다', async () => {
    const onToast = vi.fn();
    stubFetch({
      'POST /api/me/nest/attendance': () =>
        json(
          200,
          attendance(myNest({ nest: look({ level: 3, levelName: '어린 새' }) }), true, 10, true),
        ),
    });
    render(
      <MemoryRouter>
        <NestPanel handle="kim755030" isMe onToast={onToast} />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('link', { name: '새 키우기' })).toHaveAttribute('href', '/nest');
    expect(onToast).toHaveBeenCalledWith({ text: '출석했어요 +10 · 새가 어린 새로 자랐어요' });
  });

  it('오늘 이미 출석했으면 알림이 없다', async () => {
    const onToast = vi.fn();
    stubFetch({
      'POST /api/me/nest/attendance': () => json(200, attendance(myNest(), false, 0)),
    });
    render(
      <MemoryRouter>
        <NestPanel handle="kim755030" isMe onToast={onToast} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('꼬마 새')).toBeInTheDocument();
    expect(onToast).not.toHaveBeenCalled();
  });

  it('못 불러오면 칸이 없다', async () => {
    const mock = stubFetch({});
    render(
      <MemoryRouter>
        <NestPanel handle="na_ms" isMe={false} />
      </MemoryRouter>,
    );
    await vi.waitFor(() => expect(mock).toHaveBeenCalled());
    expect(screen.queryByTestId('nest-panel')).toBeNull();
  });
});
