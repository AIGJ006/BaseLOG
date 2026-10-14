import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../../api/client';
import type { AdminInquiry } from '../../../api/types/inquiry';
import { errorBody, json, requestsTo, stubFetch } from '../../../test/fetchRoutes';
import AdminInquiriesPage from '../AdminInquiriesPage';

function row(overrides: Partial<AdminInquiry> = {}): AdminInquiry {
  return {
    id: 7,
    member: { handle: 'asker01', nickname: '물어보는 새', withdrawn: false },
    category: 'BUG',
    content: '글이 안 올라가요',
    targetHandle: null,
    imageUrl: 'https://img.example.com/posts/a.webp',
    status: 'RECEIVED',
    answer: null,
    answeredAt: null,
    createdAt: '2026-10-14T01:00:00Z',
    ...overrides,
  };
}

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname + location.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin/inquiries" element={<AdminInquiriesPage />} />
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

function urls(mock: ReturnType<typeof stubFetch>) {
  return mock.mock.calls.map(([input]) => String(input));
}

describe('AdminInquiriesPage 관리자 문의 (023)', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('관리자 메뉴에 [문의]가 있고, 접수 탭에서 보낸 회원·종류·내용·사진을 보여 준다', async () => {
    const mock = stubFetch({
      'GET /api/admin/inquiries': () =>
        json(200, {
          items: [
            row(),
            row({
              id: 6,
              member: { handle: null, nickname: null, withdrawn: true },
              category: 'USER_REPORT',
              targetHandle: 'spam_man',
              imageUrl: null,
            }),
          ],
          nextBefore: null,
        }),
    });
    renderAt('/admin/inquiries');

    const nav = screen.getByRole('navigation', { name: '관리자 메뉴' });
    expect(within(nav).getByRole('link', { name: '문의' })).toHaveAttribute(
      'href',
      '/admin/inquiries',
    );
    const items = await screen.findAllByTestId('inquiry-item');
    expect(urls(mock)).toContain('/api/admin/inquiries?status=RECEIVED');
    expect(within(items[0]).getByRole('link', { name: '물어보는 새 @asker01' })).toHaveAttribute(
      'href',
      '/admin/members/asker01',
    );
    expect(within(items[0]).getByText('버그 신고')).toBeInTheDocument();
    expect(within(items[0]).getByText('글이 안 올라가요')).toBeInTheDocument();
    expect(within(items[0]).getByRole('img', { name: '붙인 사진' })).toBeInTheDocument();
    expect(within(items[1]).getByText('탈퇴한 사용자')).toBeInTheDocument();
    expect(within(items[1]).getByText('신고한 사람: @spam_man')).toBeInTheDocument();
  });

  it('답변 완료 탭으로 바꾸면 그 상태로 다시 부른다', async () => {
    const mock = stubFetch({
      'GET /api/admin/inquiries': () => json(200, { items: [], nextBefore: null }),
    });
    const user = userEvent.setup();
    renderAt('/admin/inquiries');
    expect(await screen.findByText('문의가 없어요')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: '답변 완료' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/admin/inquiries?status=answered');
    await screen.findByText('문의가 없어요');
    expect(urls(mock)).toContain('/api/admin/inquiries?status=ANSWERED');
  });

  it('접수 탭에서 답을 보내면 알림이 갔다고 알려 주고 목록에서 빠진다', async () => {
    const mock = stubFetch({
      'GET /api/admin/inquiries': () => json(200, { items: [row()], nextBefore: null }),
      'PUT /api/admin/inquiries/7/answer': () =>
        json(
          200,
          row({
            status: 'ANSWERED',
            answer: '고쳤어요',
            answeredAt: '2026-10-14T02:00:00Z',
          }),
        ),
    });
    const user = userEvent.setup();
    renderAt('/admin/inquiries');
    const [item] = await screen.findAllByTestId('inquiry-item');
    expect(within(item).getByText('접수')).toBeInTheDocument();

    await user.type(within(item).getByLabelText('답변'), '고쳤어요');
    await user.click(within(item).getByRole('button', { name: '답변 보내기' }));

    expect(
      await screen.findByText('답변을 보냈어요. 문의한 회원에게 알림이 갔어요'),
    ).toBeInTheDocument();
    const [, init] = requestsTo(mock, 'PUT', '/api/admin/inquiries/7/answer')[0];
    expect(JSON.parse(String(init?.body))).toEqual({ answer: '고쳤어요' });
    expect(screen.queryAllByTestId('inquiry-item')).toHaveLength(0);
  });

  it('빈 답은 보내지 않는다', async () => {
    const mock = stubFetch({
      'GET /api/admin/inquiries': () => json(200, { items: [row()], nextBefore: null }),
    });
    const user = userEvent.setup();
    renderAt('/admin/inquiries');
    const [item] = await screen.findAllByTestId('inquiry-item');
    await user.click(within(item).getByRole('button', { name: '답변 보내기' }));
    expect(within(item).getByRole('alert')).toHaveTextContent('답변을 적어 주세요');
    expect(requestsTo(mock, 'PUT', '/api/admin/inquiries/7/answer')).toHaveLength(0);
  });

  it('[더 보기]는 nextBefore를 보낸다', async () => {
    const mock = stubFetch({
      'GET /api/admin/inquiries': (init) => {
        void init;
        const calls = mock.mock.calls.length;
        return calls === 1
          ? json(200, { items: [row()], nextBefore: 7 })
          : json(200, { items: [row({ id: 3, content: '예전 문의' })], nextBefore: null });
      },
    });
    const user = userEvent.setup();
    renderAt('/admin/inquiries');
    await screen.findAllByTestId('inquiry-item');
    await user.click(screen.getByRole('button', { name: '더 보기' }));
    expect(await screen.findByText('예전 문의')).toBeInTheDocument();
    expect(urls(mock)).toContain('/api/admin/inquiries?status=RECEIVED&before=7');
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull();
  });

  it('목록을 못 불러오면 다시 불러오기', async () => {
    stubFetch({
      'GET /api/admin/inquiries': () =>
        json(500, errorBody('INTERNAL_ERROR', '일시적인 오류가 발생했어요')),
    });
    renderAt('/admin/inquiries');
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했어요');
  });
});
