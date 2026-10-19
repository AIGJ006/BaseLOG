import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeSummary } from '../../api/me';
import { resetClientForTests } from '../../api/client';
import { SessionContext } from '../auth/sessionContext';
import { ME, errorBody, json, requestsTo, stubFetch } from '../../test/fetchRoutes';
import NestVisitBeacon from './NestVisitBeacon';

function renderAs(me: MeSummary | null, handle: string, isMe = false) {
  return render(
    <SessionContext.Provider value={{ loading: false, me, refresh: async () => me }}>
      <NestVisitBeacon handle={handle} isMe={isMe} />
    </SessionContext.Provider>,
  );
}

const ok = () => new Response(null, { status: 204 });

describe('NestVisitBeacon', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
    window.localStorage.clear();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('둥지마다 하루 한 번만 보낸다', async () => {
    const mock = stubFetch({
      'POST /api/members/nest01/visits': ok,
      'POST /api/members/nest02/visits': ok,
    });
    renderAs(null, 'nest01').unmount();
    await waitFor(() =>
      expect(window.localStorage.getItem('baselog.nestVisits')).toContain('nest01'),
    );
    renderAs(null, 'nest01').unmount();
    renderAs(null, 'nest02');
    await waitFor(() =>
      expect(requestsTo(mock, 'POST', '/api/members/nest02/visits')).toHaveLength(1),
    );
    expect(requestsTo(mock, 'POST', '/api/members/nest01/visits')).toHaveLength(1);
  });

  it('실패하면 표시를 남기지 않아 다음에 다시 보낸다', async () => {
    const mock = stubFetch({
      'POST /api/members/nest01/visits': () =>
        json(503, errorBody('SERVICE_UNAVAILABLE', '잠시 후 다시 시도해 주세요')),
    });
    renderAs(null, 'nest01').unmount();
    await waitFor(() =>
      expect(requestsTo(mock, 'POST', '/api/members/nest01/visits')).toHaveLength(1),
    );
    renderAs(null, 'nest01');
    await waitFor(() =>
      expect(requestsTo(mock, 'POST', '/api/members/nest01/visits')).toHaveLength(2),
    );
  });

  it('내 둥지와 관리자는 보내지 않는다', async () => {
    const mock = stubFetch({ 'POST /api/members/nest01/visits': ok });
    renderAs(ME as MeSummary, 'nest01', true).unmount();
    renderAs({ ...(ME as MeSummary), role: 'ADMIN' }, 'nest01');
    await new Promise((r) => setTimeout(r, 20));
    expect(requestsTo(mock, 'POST', '/api/members/nest01/visits')).toHaveLength(0);
  });
});
