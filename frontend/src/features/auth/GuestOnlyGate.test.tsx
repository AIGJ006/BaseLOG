import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { MeSummary } from '../../api/me';
import { GuestOnlyGate } from './GuestOnlyGate';
import { SessionContext } from './sessionContext';

function renderAt(entry: string, me: MeSummary | null, loading = false) {
  return render(
    <SessionContext.Provider value={{ loading, me, refresh: async () => me }}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route
            path="/login"
            element={
              <GuestOnlyGate>
                <p>로그인 화면</p>
              </GuestOnlyGate>
            }
          />
          <Route path="/" element={<p>홈</p>} />
          <Route path="/write/new" element={<p>글쓰기</p>} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}

const ME = { handle: 'someone' } as unknown as MeSummary;

describe('GuestOnlyGate', () => {
  it('비로그인이면 화면을 보인다', () => {
    renderAt('/login', null);
    expect(screen.getByText('로그인 화면')).toBeInTheDocument();
  });

  it('로그인 상태를 읽는 동안은 아무것도 보이지 않는다', () => {
    renderAt('/login', null, true);
    expect(screen.queryByText('로그인 화면')).not.toBeInTheDocument();
  });

  it('이미 로그인했으면 홈으로 보낸다', () => {
    renderAt('/login', ME);
    expect(screen.getByText('홈')).toBeInTheDocument();
  });

  it('이미 로그인했으면 돌아갈 곳으로 보낸다', () => {
    renderAt('/login?returnTo=%2Fwrite%2Fnew', ME);
    expect(screen.getByText('글쓰기')).toBeInTheDocument();
  });

  it('돌아갈 곳이 안전하지 않으면 홈으로 보낸다', () => {
    renderAt('/login?returnTo=%2F%2Fevil.example', ME);
    expect(screen.getByText('홈')).toBeInTheDocument();
  });
});
