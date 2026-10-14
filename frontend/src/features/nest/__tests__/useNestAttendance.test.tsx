import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../../api/client';
import { json, requestsTo, stubFetch } from '../../../test/fetchRoutes';
import { useNestAttendance } from '../useNestAttendance';
import { attendance, look, myNest } from './nestFixtures';

describe('useNestAttendance (021 US3)', () => {
  beforeEach(() => resetClientForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('내 둥지면 출석하고 처음이면 알림을 띄운다', async () => {
    const onToast = vi.fn();
    stubFetch({
      'POST /api/me/nest/attendance': () =>
        json(
          200,
          attendance(myNest({ nest: look({ level: 3, levelName: '어린 새' }) }), true, 10, true),
        ),
    });
    renderHook(() => useNestAttendance(true, onToast));
    await vi.waitFor(() =>
      expect(onToast).toHaveBeenCalledWith({ text: '출석했어요 +10 · 새가 어린 새로 자랐어요' }),
    );
  });

  it('오늘 이미 출석했으면 알림이 없다', async () => {
    const onToast = vi.fn();
    const mock = stubFetch({
      'POST /api/me/nest/attendance': () => json(200, attendance(myNest(), false, 0)),
    });
    renderHook(() => useNestAttendance(true, onToast));
    await vi.waitFor(() =>
      expect(requestsTo(mock, 'POST', '/api/me/nest/attendance')).toHaveLength(1),
    );
    expect(onToast).not.toHaveBeenCalled();
  });

  it('남의 둥지는 출석하지 않는다', async () => {
    const mock = stubFetch({});
    renderHook(() => useNestAttendance(false));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestsTo(mock, 'POST', '/api/me/nest/attendance')).toHaveLength(0);
  });
});
