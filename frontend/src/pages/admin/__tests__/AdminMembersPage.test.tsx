import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../../api/client';
import type { AdminMemberList, AdminMemberRow } from '../../../api/types/moderation';
import { errorBody, json, stubFetch } from '../../../test/fetchRoutes';
import AdminMembersPage from '../AdminMembersPage';

function row(overrides: Partial<AdminMemberRow> = {}): AdminMemberRow {
  return {
    handle: 'writer01',
    nickname: '글쓴이',
    email: 'writer@example.com',
    provider: 'LOCAL',
    role: 'USER',
    status: 'ACTIVE',
    joinedAt: '2026-10-01T00:00:00Z',
    lastLoginAt: '2026-10-12T03:00:00Z',
    ...overrides,
  };
}

function page(items: AdminMemberRow[], overrides: Partial<AdminMemberList> = {}): AdminMemberList {
  return { items, page: 1, size: 20, total: items.length, totalPages: 1, ...overrides };
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/members" element={<AdminMembersPage />} />
        <Route path="/admin/members/:handle" element={<p>회원 한 명</p>} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

function urls(mock: ReturnType<typeof stubFetch>) {
  return mock.mock.calls.map(([input]) => String(input));
}

describe('AdminMembersPage', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('전체 수와 회원마다 이메일·가입 방식·상태를 보여 주고 이름은 회원 화면으로 이어진다', async () => {
    stubFetch({
      'GET /api/admin/members': () =>
        json(
          200,
          page(
            [
              row(),
              row({
                handle: 'gi-octo',
                nickname: '옥토',
                email: null,
                provider: 'GITHUB',
                status: 'SUSPENDED',
                lastLoginAt: null,
              }),
              row({ handle: 'admin001', nickname: '관리자', role: 'ADMIN' }),
            ],
            { total: 3 },
          ),
        ),
    });
    renderAt('/admin/members');

    const items = await screen.findAllByTestId('member-item');
    expect(screen.getByTestId('member-total')).toHaveTextContent('전체 3명');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('writer@example.com');
    expect(items[0]).toHaveTextContent('이메일 로그인');
    expect(items[0]).not.toHaveTextContent('정지');
    expect(items[1]).toHaveTextContent('이메일 없음');
    expect(items[1]).toHaveTextContent('GitHub 로그인');
    expect(items[1]).toHaveTextContent('정지');
    expect(items[1]).toHaveTextContent('로그인 기록 없음');
    expect(items[2]).toHaveTextContent('관리자');
    expect(within(items[0]).getByRole('link', { name: '글쓴이' })).toHaveAttribute(
      'href',
      '/admin/members/writer01',
    );
    expect(screen.getByRole('navigation', { name: '관리자 메뉴' })).toBeInTheDocument();
  });

  it('검색어와 상태는 주소창과 요청에 담기고 상태를 바꾸면 첫 쪽부터', async () => {
    const user = userEvent.setup();
    const mock = stubFetch({ 'GET /api/admin/members': () => json(200, page([row()])) });
    renderAt('/admin/members?page=2');
    await screen.findByTestId('member-item');
    expect(urls(mock)[0]).toBe('/api/admin/members?page=2');

    await user.type(
      screen.getByRole('searchbox', { name: '주소·닉네임·이메일로 찾기' }),
      ' 김민서 ',
    );
    await user.click(screen.getByRole('button', { name: '찾기' }));
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent(
        `/admin/members?q=${encodeURIComponent('김민서')}`,
      ),
    );
    await waitFor(() =>
      expect(urls(mock).at(-1)).toBe(`/api/admin/members?q=${encodeURIComponent('김민서')}`),
    );

    await user.selectOptions(screen.getByRole('combobox', { name: '상태' }), 'SUSPENDED');
    await waitFor(() =>
      expect(urls(mock).at(-1)).toBe(
        `/api/admin/members?q=${encodeURIComponent('김민서')}&status=SUSPENDED`,
      ),
    );
  });

  it('여러 쪽이면 [이전]·[다음]으로 넘긴다', async () => {
    const user = userEvent.setup();
    const mock = stubFetch({
      'GET /api/admin/members': () =>
        json(200, page([row()], { total: 45, totalPages: 3, page: 1 })),
    });
    renderAt('/admin/members');
    await screen.findByTestId('member-item');

    expect(screen.getByRole('button', { name: '이전' })).toBeDisabled();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '다음' }));
    await waitFor(() => expect(urls(mock).at(-1)).toBe('/api/admin/members?page=2'));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
  });

  it('찾는 회원이 없으면 안내, 불러오지 못하면 [다시 불러오기]', async () => {
    const user = userEvent.setup();
    let fail = true;
    stubFetch({
      'GET /api/admin/members': () =>
        fail
          ? json(500, errorBody('INTERNAL_ERROR', '잠시 후 다시 시도해 주세요'))
          : json(200, page([])),
    });
    renderAt('/admin/members?q=없는사람');

    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했어요');
    fail = false;
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findByText('찾는 회원이 없어요')).toBeInTheDocument();
  });
});
