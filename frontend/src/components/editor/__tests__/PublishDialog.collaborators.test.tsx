import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../../api/client';
import { errorBody, json, requestsTo, stubFetch } from '../../../test/fetchRoutes';
import { NO_FRIENDS_TEXT } from '../../../features/collaborators/CollaboratorPicker';
import {
  COLLABORATORS_NO_PRIVATE,
  PRIVATE_NO_COLLABORATORS,
} from '../../../features/collaborators/collaboratorSelection';
import PublishDialog, { COLLABORATORS_NOT_SAVED } from '../PublishDialog';

const PUBLISHED = {
  url: '/@kim755030/posts/42',
  publishedAt: '2026-10-07T05:00:00Z',
  firstPublicAt: '2026-10-07T05:00:00Z',
  editedAt: null,
  version: 4,
};

function friend(handle: string, nickname: string) {
  return { handle, nickname, profileImageUrl: null, friendsSince: '2026-09-01T00:00:00Z' };
}

const FRIENDS = [
  friend('hana', '하나'),
  friend('dul', '둘'),
  friend('set', '셋'),
  friend('net', '넷'),
];

function renderDialog(initialVisibility: 'PUBLIC' | 'PRIVATE' = 'PUBLIC') {
  const props = {
    postId: 42,
    getContent: async () => ({ title: '제목', contentMd: '본문', baseVersion: 3 }),
    initialTags: [],
    initialVisibility,
    onPublished: vi.fn(),
    onFieldErrors: vi.fn(),
    onClose: vi.fn(),
  };
  render(<PublishDialog {...props} />);
  return props;
}

function sentBody(call: unknown[] | undefined) {
  return JSON.parse(String((call?.[1] as RequestInit).body));
}

beforeEach(() => {
  resetClientForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PublishDialog — 공동 작업자 고르기', () => {
  it('지금 고른 사람은 체크돼 있고, 3명이면 나머지 칸이 꺼진다', async () => {
    stubFetch({
      'GET /api/posts/42/collaborators': () =>
        json(200, { items: [{ handle: 'dul', nickname: '둘', profileImageUrl: null }] }),
      'GET /api/me/friends': () => json(200, { items: FRIENDS, nextCursor: null }),
    });
    const user = userEvent.setup();
    renderDialog();

    const group = await screen.findByRole('group', { name: /공동 작업자/ });
    expect(await within(group).findByRole('checkbox', { name: /둘/ })).toBeChecked();
    expect(within(group).getByText('1 / 3')).toBeInTheDocument();

    await user.click(within(group).getByRole('checkbox', { name: /하나/ }));
    await user.click(within(group).getByRole('checkbox', { name: /셋/ }));
    expect(within(group).getByText('3 / 3')).toBeInTheDocument();
    expect(within(group).getByRole('checkbox', { name: /넷/ })).toBeDisabled();
    expect(within(group).getByRole('checkbox', { name: /하나/ })).toBeEnabled();
  });

  it('친구가 없으면 안내를 보인다', async () => {
    stubFetch({
      'GET /api/posts/42/collaborators': () => json(200, { items: [] }),
      'GET /api/me/friends': () => json(200, { items: [], nextCursor: null }),
    });
    renderDialog();
    expect(await screen.findByText(NO_FRIENDS_TEXT)).toBeInTheDocument();
  });

  it('목록을 못 읽으면 [다시 시도]로 다시 읽는다', async () => {
    stubFetch({
      'GET /api/posts/42/collaborators': () => json(500, errorBody('INTERNAL_ERROR', '오류')),
      'GET /api/me/friends': () => json(200, { items: FRIENDS, nextCursor: null }),
    });
    const user = userEvent.setup();
    renderDialog();
    const retry = await screen.findByRole('button', { name: '다시 시도' });
    stubFetch({
      'GET /api/posts/42/collaborators': () => json(200, { items: [] }),
      'GET /api/me/friends': () => json(200, { items: FRIENDS, nextCursor: null }),
    });
    await user.click(retry);
    expect(await screen.findByRole('checkbox', { name: /하나/ })).toBeInTheDocument();
  });

  it('[더 보기]로 다음 친구를 더 읽는다', async () => {
    stubFetch({
      'GET /api/posts/42/collaborators': () => json(200, { items: [] }),
      'GET /api/me/friends': () => json(200, { items: [FRIENDS[0]], nextCursor: 'c1' }),
    });
    const user = userEvent.setup();
    renderDialog();
    await screen.findByRole('checkbox', { name: /하나/ });
    stubFetch({
      'GET /api/me/friends': () => json(200, { items: [FRIENDS[1]], nextCursor: null }),
    });
    await user.click(screen.getByRole('button', { name: '더 보기' }));
    expect(await screen.findByRole('checkbox', { name: /둘/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeInTheDocument();
  });

  it('바꾼 목록은 등록이 성공한 뒤에 저장한다', async () => {
    const fetchMock = stubFetch({
      'GET /api/posts/42/collaborators': () => json(200, { items: [] }),
      'GET /api/me/friends': () => json(200, { items: FRIENDS, nextCursor: null }),
      'POST /api/posts/42/publish': () => json(200, PUBLISHED),
      'PUT /api/posts/42/collaborators': () =>
        json(200, { items: [{ handle: 'hana', nickname: '하나', profileImageUrl: null }] }),
    });
    const user = userEvent.setup();
    const props = renderDialog();
    await user.click(await screen.findByRole('checkbox', { name: /하나/ }));
    expect(requestsTo(fetchMock, 'PUT', '/api/posts/42/collaborators')).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(props.onPublished).toHaveBeenCalledWith(PUBLISHED));
    const order = fetchMock.mock.calls.map(([input, init]) => `${init?.method ?? 'GET'} ${input}`);
    expect(order.indexOf('POST /api/posts/42/publish')).toBeLessThan(
      order.indexOf('PUT /api/posts/42/collaborators'),
    );
    expect(sentBody(requestsTo(fetchMock, 'PUT', '/api/posts/42/collaborators')[0])).toEqual({
      handles: ['hana'],
    });
  });

  it('바꾸지 않았으면 저장하지 않는다', async () => {
    const fetchMock = stubFetch({
      'GET /api/posts/42/collaborators': () => json(200, { items: [] }),
      'GET /api/me/friends': () => json(200, { items: FRIENDS, nextCursor: null }),
      'POST /api/posts/42/publish': () => json(200, PUBLISHED),
    });
    const user = userEvent.setup();
    const props = renderDialog();
    await screen.findByRole('checkbox', { name: /하나/ });
    await user.click(screen.getByRole('button', { name: '등록' }));
    await waitFor(() => expect(props.onPublished).toHaveBeenCalled());
    expect(requestsTo(fetchMock, 'PUT', '/api/posts/42/collaborators')).toHaveLength(0);
  });

  it('저장이 400이면 서버 문구를 보이고, [다시 저장]은 다시 등록하지 않는다', async () => {
    const replies = [
      () =>
        json(
          400,
          errorBody('VALIDATION_FAILED', '입력값을 확인해 주세요', [
            {
              field: 'handles',
              code: 'COLLABORATOR_NOT_FRIEND',
              message: '친구만 공동 작업자로 고를 수 있어요',
            },
          ]),
        ),
      () => json(200, { items: [] }),
    ];
    const fetchMock = stubFetch({
      'GET /api/posts/42/collaborators': () => json(200, { items: [] }),
      'GET /api/me/friends': () => json(200, { items: FRIENDS, nextCursor: null }),
      'POST /api/posts/42/publish': () => json(200, PUBLISHED),
      'PUT /api/posts/42/collaborators': () => replies.shift()!(),
    });
    const user = userEvent.setup();
    const props = renderDialog();
    await user.click(await screen.findByRole('checkbox', { name: /하나/ }));
    await user.click(screen.getByRole('button', { name: '등록' }));

    expect(await screen.findByText('친구만 공동 작업자로 고를 수 있어요')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(COLLABORATORS_NOT_SAVED);
    expect(props.onPublished).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '건너뛰기' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '다시 저장' }));
    await waitFor(() => expect(props.onPublished).toHaveBeenCalledWith(PUBLISHED));
    expect(requestsTo(fetchMock, 'POST', '/api/posts/42/publish')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'PUT', '/api/posts/42/collaborators')).toHaveLength(2);
  });

  it('고른 사람이 있으면 나만 보기를 고를 수 없다', async () => {
    stubFetch({
      'GET /api/posts/42/collaborators': () =>
        json(200, { items: [{ handle: 'dul', nickname: '둘', profileImageUrl: null }] }),
      'GET /api/me/friends': () => json(200, { items: FRIENDS, nextCursor: null }),
    });
    renderDialog();
    await screen.findByRole('checkbox', { name: /둘/ });
    expect(screen.getByRole('option', { name: '🔒 나만 보기' })).toBeDisabled();
    expect(screen.getByText(COLLABORATORS_NO_PRIVATE)).toBeInTheDocument();
  });

  it('나만 보기 글이면 칸을 끄고 안내하며, 고른 사람이 있으면 등록을 막는다', async () => {
    const fetchMock = stubFetch({
      'GET /api/posts/42/collaborators': () =>
        json(200, { items: [{ handle: 'dul', nickname: '둘', profileImageUrl: null }] }),
      'GET /api/me/friends': () => json(200, { items: FRIENDS, nextCursor: null }),
      'POST /api/posts/42/publish': () => json(200, PUBLISHED),
    });
    const user = userEvent.setup();
    const props = renderDialog('PRIVATE');
    const group = await screen.findByRole('group', { name: /공동 작업자/ });
    expect(await within(group).findByRole('checkbox', { name: /둘/ })).toBeChecked();
    expect(within(group).getByRole('checkbox', { name: /둘/ })).toBeDisabled();
    expect(within(group).getByRole('checkbox', { name: /하나/ })).toBeDisabled();
    expect(within(group).getByText(PRIVATE_NO_COLLABORATORS)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '등록' }));
    expect(screen.getByRole('alert')).toHaveTextContent(PRIVATE_NO_COLLABORATORS);
    expect(requestsTo(fetchMock, 'POST', '/api/posts/42/publish')).toHaveLength(0);
    expect(props.onPublished).not.toHaveBeenCalled();
  });
});
