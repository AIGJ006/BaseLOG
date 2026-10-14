import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeSummary } from '../../api/me';
import { resetClientForTests } from '../../api/client';
import { SessionContext } from '../../features/auth/sessionContext';
import { ME, errorBody, json, requestsTo, stubFetch } from '../../test/fetchRoutes';
import SiteVisitBeacon from '../SiteVisitBeacon';

function renderAs(me: MeSummary | null) {
  return render(
    <SessionContext.Provider value={{ loading: false, me, refresh: async () => me }}>
      <SiteVisitBeacon />
    </SessionContext.Provider>,
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

  it('관리자는 보내지 않는다', () => {
    const mock = stubFetch({});
    renderAs({ ...(ME as MeSummary), role: 'ADMIN' });
    expect(requestsTo(mock, 'POST', '/api/visits')).toHaveLength(0);
  });
});
