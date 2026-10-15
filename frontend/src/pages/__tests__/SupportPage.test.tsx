import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MeSummary } from '../../api/me';
import { resetClientForTests } from '../../api/client';
import type { Inquiry } from '../../api/types/inquiry';
import { SessionContext } from '../../features/auth/sessionContext';
import { ME, errorBody, json, requestsTo, stubFetch } from '../../test/fetchRoutes';
import SupportPage from '../SupportPage';

function inquiry(overrides: Partial<Inquiry> = {}): Inquiry {
  return {
    id: 1,
    category: 'BUG',
    content: '글이 안 올라가요',
    targetHandle: null,
    imageUrl: null,
    status: 'RECEIVED',
    answer: null,
    answeredAt: null,
    createdAt: '2026-10-14T01:00:00Z',
    ...overrides,
  };
}

function Where() {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
}

function renderPage(loggedIn = true, path = '/support') {
  const session = {
    loading: false,
    me: loggedIn ? ({ ...ME, emailVerified: true } as MeSummary) : null,
    refresh: async () => null,
  };
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SessionContext.Provider value={session}>
        <Where />
        <Routes>
          <Route path="/support" element={<SupportPage />} />
          <Route path="*" element={null} />
        </Routes>
      </SessionContext.Provider>
    </MemoryRouter>,
  );
}

function bodyOf(mock: ReturnType<typeof stubFetch>, path: string) {
  const [, init] = requestsTo(mock, 'POST', path)[0];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe('SupportPage 문의·신고 (023)', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('비로그인은 로그인 화면으로 보낸다', async () => {
    const mock = stubFetch({});
    renderPage(false);
    await waitFor(() =>
      expect(screen.getByTestId('where')).toHaveTextContent('/login?returnTo=%2Fsupport'),
    );
    expect(mock).not.toHaveBeenCalled();
  });

  it('내가 보낸 문의를 새것부터 종류·날짜·상태·내용·답변과 함께 보여 준다', async () => {
    stubFetch({
      'GET /api/me/inquiries': () =>
        json(200, {
          items: [
            inquiry({
              id: 2,
              category: 'ACCOUNT',
              content: '비밀번호를 잊었어요',
              status: 'ANSWERED',
              answer: '비밀번호 찾기를 써 주세요',
              answeredAt: '2026-10-14T03:00:00Z',
              createdAt: '2026-10-14T02:00:00Z',
            }),
            inquiry(),
          ],
        }),
    });
    renderPage(true, '/support?tab=mine');
    expect(await screen.findByRole('heading', { name: '문의·신고' })).toBeInTheDocument();
    expect(
      screen.getByText('글·댓글 신고는 각 글·댓글의 [신고] 버튼을 쓰면 더 빨라요.'),
    ).toBeInTheDocument();

    const items = await screen.findAllByTestId('inquiry-item');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('계정 문의')).toBeInTheDocument();
    expect(within(items[0]).getByText('답변 완료')).toBeInTheDocument();
    expect(within(items[0]).getByText('2026.10.14')).toBeInTheDocument();
    expect(within(items[0]).getByRole('region', { name: '답변' })).toHaveTextContent(
      '비밀번호 찾기를 써 주세요',
    );
    expect(within(items[1]).getByText('버그 신고')).toBeInTheDocument();
    expect(within(items[1]).getByText('접수')).toBeInTheDocument();
    expect(within(items[1]).queryByRole('region', { name: '답변' })).toBeNull();
  });

  it('탭은 [문의·신고하기]·[내 문의·신고 N]이고, 처음엔 보내기 탭이 열린다', async () => {
    stubFetch({ 'GET /api/me/inquiries': () => json(200, { items: [inquiry()] }) });
    const user = userEvent.setup();
    renderPage();
    const write = screen.getByRole('tab', { name: '문의·신고하기' });
    expect(write).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('내용')).toBeVisible();
    const mine = await screen.findByRole('tab', { name: '내 문의·신고 1' });

    await user.click(mine);
    expect(mine).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('where')).toHaveTextContent('/support?tab=mine');
    expect(screen.getByTestId('inquiry-item')).toBeVisible();
    expect(screen.getByLabelText('내용')).not.toBeVisible();
  });

  it('보낸 문의가 없으면 안내를 보여 준다', async () => {
    stubFetch({ 'GET /api/me/inquiries': () => json(200, { items: [] }) });
    renderPage();
    expect(await screen.findByText('아직 보낸 문의가 없어요')).toBeInTheDocument();
  });

  it('보내면 목록 맨 위에 접수로 붙고 칸을 비운다', async () => {
    const mock = stubFetch({
      'GET /api/me/inquiries': () => json(200, { items: [inquiry()] }),
      'POST /api/me/inquiries': () =>
        json(201, inquiry({ id: 5, category: 'OTHER', content: '다크 모드가 좋아요' })),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findAllByTestId('inquiry-item');

    const submit = screen.getByRole('button', { name: '보내기' });
    expect(submit).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('종류'), 'OTHER');
    const content = screen.getByLabelText('내용');
    await user.type(content, '다크 모드가 좋아요');
    expect(screen.getByText('10/2000')).toBeInTheDocument();
    await user.click(submit);

    expect(await screen.findByRole('status')).toHaveTextContent(
      '문의를 보냈어요. 답이 오면 알려 드릴게요',
    );
    expect(bodyOf(mock, '/api/me/inquiries')).toEqual({
      category: 'OTHER',
      content: '다크 모드가 좋아요',
      targetHandle: null,
      imageId: null,
    });
    expect(content).toHaveValue('');
    const items = screen.getAllByTestId('inquiry-item');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('다크 모드가 좋아요');
  });

  it('사용자 신고를 고르면 신고할 사람 블로그 주소 칸이 나온다', async () => {
    const mock = stubFetch({
      'GET /api/me/inquiries': () => json(200, { items: [] }),
      'POST /api/me/inquiries': () =>
        json(201, inquiry({ category: 'USER_REPORT', targetHandle: 'spam_man' })),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('아직 보낸 문의가 없어요');
    expect(screen.queryByLabelText('신고할 사람 블로그 주소 (선택)')).toBeNull();

    await user.selectOptions(screen.getByLabelText('종류'), 'USER_REPORT');
    await user.type(screen.getByLabelText('신고할 사람 블로그 주소 (선택)'), '@spam_man');
    await user.type(screen.getByLabelText('내용'), '광고만 올려요');
    await user.click(screen.getByRole('button', { name: '보내기' }));

    await screen.findByRole('status');
    expect(bodyOf(mock, '/api/me/inquiries')).toMatchObject({
      category: 'USER_REPORT',
      targetHandle: '@spam_man',
    });
    expect(screen.getByText('신고한 사람: @spam_man')).toBeInTheDocument();
  });

  it('서버 칸 오류 문구를 그대로 보여 준다', async () => {
    stubFetch({
      'GET /api/me/inquiries': () => json(200, { items: [] }),
      'POST /api/me/inquiries': () =>
        json(
          400,
          errorBody('VALIDATION_FAILED', '입력한 내용을 확인해 주세요', [
            {
              field: 'targetHandle',
              code: 'INVALID_VALUE',
              message: '블로그 주소를 확인해 주세요',
            },
          ]),
        ),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('아직 보낸 문의가 없어요');
    await user.type(screen.getByLabelText('내용'), '내용');
    await user.click(screen.getByRole('button', { name: '보내기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('블로그 주소를 확인해 주세요');
  });

  it('하루 한도를 넘으면 잠시 후 다시 시도하라고 한다', async () => {
    stubFetch({
      'GET /api/me/inquiries': () => json(200, { items: [] }),
      'POST /api/me/inquiries': () =>
        json(429, errorBody('TOO_MANY_REQUESTS', '잠시 후 다시 시도해 주세요'), {
          'Retry-After': '60',
        }),
    });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('아직 보낸 문의가 없어요');
    await user.type(screen.getByLabelText('내용'), '내용');
    await user.click(screen.getByRole('button', { name: '보내기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요');
  });

  it('목록을 못 불러오면 다시 불러오기', async () => {
    let calls = 0;
    stubFetch({
      'GET /api/me/inquiries': () => {
        calls += 1;
        return calls === 1
          ? json(500, errorBody('INTERNAL_ERROR', '일시적인 오류가 발생했어요'))
          : json(200, { items: [inquiry()] });
      },
    });
    const user = userEvent.setup();
    renderPage(true, '/support?tab=mine');
    expect(await screen.findByRole('alert')).toHaveTextContent('불러오지 못했어요');
    await user.click(screen.getByRole('button', { name: '다시 불러오기' }));
    expect(await screen.findAllByTestId('inquiry-item')).toHaveLength(1);
  });
});
