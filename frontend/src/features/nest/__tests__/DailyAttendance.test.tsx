import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link, MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeSummary } from '../../../api/me';
import { resetClientForTests } from '../../../api/client';
import { ME, errorBody, json, requestsTo, stubFetch } from '../../../test/fetchRoutes';
import { SessionContext } from '../../auth/sessionContext';
import DailyAttendance from '../DailyAttendance';
import { attendance, look, myNest } from './nestFixtures';

const ATTEND = '/api/me/nest/attendance';

function renderAt(me: MeSummary | null, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionContext.Provider value={{ loading: false, me, refresh: async () => me }}>
        <DailyAttendance />
        <Link to="/next">다음 화면</Link>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('DailyAttendance (021 US3, 로그인만 해도 출석)', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('로그인했으면 아무 화면에서나 출석하고 알림을 띄운다', async () => {
    stubFetch({
      [`POST ${ATTEND}`]: () =>
        json(
          200,
          attendance(myNest({ nest: look({ level: 3, levelName: '어린 새' }) }), true, 10, true),
        ),
    });
    renderAt(ME as MeSummary);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '출석했어요 +10 · 새가 어린 새로 자랐어요',
    );
  });

  it('하루에 한 번만 부르고, 이미 출석했으면 알림이 없다', async () => {
    const mock = stubFetch({ [`POST ${ATTEND}`]: () => json(200, attendance(myNest(), false, 0)) });
    renderAt(ME as MeSummary);
    await waitFor(() => expect(requestsTo(mock, 'POST', ATTEND)).toHaveLength(1));
    await userEvent.click(screen.getByText('다음 화면'));
    expect(requestsTo(mock, 'POST', ATTEND)).toHaveLength(1);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('실패하면 다음 화면에서 다시 부른다', async () => {
    let calls = 0;
    const mock = stubFetch({
      [`POST ${ATTEND}`]: () =>
        ++calls === 1
          ? json(500, errorBody('INTERNAL_ERROR', '잠시 후 다시 시도해 주세요'))
          : json(200, attendance(myNest())),
    });
    renderAt(ME as MeSummary);
    await waitFor(() => expect(requestsTo(mock, 'POST', ATTEND)).toHaveLength(1));
    await userEvent.click(screen.getByText('다음 화면'));
    await waitFor(() => expect(requestsTo(mock, 'POST', ATTEND)).toHaveLength(2));
    expect(await screen.findByRole('status')).toHaveTextContent('출석했어요 +10');
  });

  it('비로그인이거나 [새 키우기] 화면이면 부르지 않는다', async () => {
    const mock = stubFetch({});
    renderAt(null).unmount();
    renderAt(ME as MeSummary, '/nest');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(requestsTo(mock, 'POST', ATTEND)).toHaveLength(0);
  });
});

describe('DailyAttendance — [새 키우기] 화면에서 나올 때', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('[새 키우기] 화면에서 다른 화면으로 옮기면 한 번 부른다 (그 화면의 출석이 실패했을 때 대비)', async () => {
    const mock = stubFetch({ [`POST ${ATTEND}`]: () => json(200, attendance(myNest(), false, 0)) });
    renderAt(ME as MeSummary, '/nest');
    expect(requestsTo(mock, 'POST', ATTEND)).toHaveLength(0);
    await userEvent.click(screen.getByText('다음 화면'));
    await waitFor(() => expect(requestsTo(mock, 'POST', ATTEND)).toHaveLength(1));
  });
});
