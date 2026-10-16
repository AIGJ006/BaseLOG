import { render, waitFor } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeSummary } from '../../api/me';
import { resetClientForTests } from '../../api/client';
import { SessionContext } from '../../features/auth/sessionContext';
import { ME, errorBody, json, requestsTo, stubFetch } from '../../test/fetchRoutes';
import SiteVisitBeacon from '../SiteVisitBeacon';

function renderAs(me: MeSummary | null) {
  return render(
    <MemoryRouter>
      <SessionContext.Provider value={{ loading: false, me, refresh: async () => me }}>
        <SiteVisitBeacon />
        <Link to="/next">다음 화면</Link>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}

describe('SiteVisitBeacon', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
    window.localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('하루 한 번만 보낸다', async () => {
    const mock = stubFetch({ 'POST /api/visits': () => new Response(null, { status: 204 }) });
    renderAs(null).unmount();
    await waitFor(() => expect(window.localStorage.getItem('baselog.visit')).not.toBeNull());
    renderAs(null);
    expect(requestsTo(mock, 'POST', '/api/visits')).toHaveLength(1);
  });

  it('실패하면 표시를 남기지 않아 다음 화면에서 다시 보낸다', async () => {
    const mock = stubFetch({
      'POST /api/visits': () =>
        json(429, errorBody('TOO_MANY_REQUESTS', '잠시 후 다시 시도해 주세요')),
    });
    renderAs(ME as MeSummary);
    await waitFor(() => expect(requestsTo(mock, 'POST', '/api/visits')).toHaveLength(1));
    expect(window.localStorage.getItem('baselog.visit')).toBeNull();
  });

  it('실패한 뒤 화면을 옮기면 다시 보낸다', async () => {
    let calls = 0;
    const mock = stubFetch({
      'POST /api/visits': () =>
        ++calls === 1
          ? json(429, errorBody('TOO_MANY_REQUESTS', '잠시 후 다시 시도해 주세요'))
          : new Response(null, { status: 204 }),
    });
    const view = renderAs(null);
    await waitFor(() => expect(requestsTo(mock, 'POST', '/api/visits')).toHaveLength(1));
    await userEvent.click(view.getByText('다음 화면'));
    await waitFor(() => expect(window.localStorage.getItem('baselog.visit')).not.toBeNull());
    expect(requestsTo(mock, 'POST', '/api/visits')).toHaveLength(2);
  });

  it('자정을 넘긴 뒤 화면을 옮기면 새 날 방문을 보낸다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-10-16T14:59:00Z')); // 한국 23:59
      const mock = stubFetch({ 'POST /api/visits': () => new Response(null, { status: 204 }) });
      const view = renderAs(null);
      await waitFor(() =>
        expect(window.localStorage.getItem('baselog.visit')).toBe('2026-10-16:guest'),
      );
      vi.setSystemTime(new Date('2026-10-16T15:01:00Z')); // 한국 다음 날 00:01
      await userEvent.click(view.getByText('다음 화면'));
      await waitFor(() =>
        expect(window.localStorage.getItem('baselog.visit')).toBe('2026-10-17:guest'),
      );
      expect(requestsTo(mock, 'POST', '/api/visits')).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('관리자는 보내지 않는다', () => {
    const mock = stubFetch({});
    renderAs({ ...(ME as MeSummary), role: 'ADMIN' });
    expect(requestsTo(mock, 'POST', '/api/visits')).toHaveLength(0);
  });
});
