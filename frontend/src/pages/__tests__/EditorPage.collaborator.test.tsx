import 'fake-indexeddb/auto';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../api/client';
import type { MeSummary } from '../../api/me';
import type { WorkingCopy } from '../../api/posts';
import { SessionContext } from '../../features/auth/sessionContext';
import { resetLocalDraftsForTests } from '../../features/editor/localDraftStore';
import { ME, json, requestsTo, stubFetch } from '../../test/fetchRoutes';
import EditorPage from '../EditorPage';

const COPY: WorkingCopy = {
  postId: 42,
  status: 'PUBLISHED',
  editing: false,
  title: '함께 쓰는 글',
  contentMd: '본문',
  version: 5,
  savedAt: '2026-10-07T05:03:00Z',
  visibility: 'FRIENDS',
  tags: ['여행'],
  url: '/@na_ms/posts/42',
  thumbnailUrl: null,
  collaborator: true,
};

function Where() {
  const location = useLocation();
  return <output data-testid="where">{location.pathname}</output>;
}

function renderEditor() {
  const me = ME as unknown as MeSummary;
  return render(
    <SessionContext.Provider value={{ loading: false, me, refresh: async () => me }}>
      <MemoryRouter initialEntries={['/write/42']}>
        <Routes>
          <Route path="/write/:postId" element={<EditorPage />} />
          <Route path="*" element={<p>다른 화면</p>} />
        </Routes>
        <Where />
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}

let assign: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  resetClientForTests();
  await resetLocalDraftsForTests();
  assign = vi.fn();
  vi.stubGlobal('location', { ...window.location, assign });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 공동 작업자가 여는 에디터 — 제목·본문만 고친다. */
describe('EditorPage — 공동 작업자', () => {
  it('사진·첨부파일·카테고리 없이 열고 첨부파일 목록도 읽지 않는다', async () => {
    const fetchMock = stubFetch({
      'GET /api/posts/42/working-copy': () => json(200, COPY),
      'POST /api/markdown/preview': () => json(200, { html: '' }),
    });
    renderEditor();
    expect(await screen.findByLabelText('제목')).toHaveValue('함께 쓰는 글');

    expect(screen.queryByRole('button', { name: '첨부파일' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('사진 고르기')).not.toBeInTheDocument();
    const toolbar = screen.getByRole('toolbar', { name: '글쓰기 도구' });
    expect(within(toolbar).queryByRole('button', { name: /사진/ })).not.toBeInTheDocument();
    expect(within(toolbar).getByRole('button', { name: /링크/ })).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'GET', '/api/posts/42/attachments')).toHaveLength(0);
    expect(requestsTo(fetchMock, 'GET', '/api/posts/42/category')).toHaveLength(0);
  });

  it('등록 창은 다시 등록할지만 묻고, 작업본 값을 그대로 보낸 뒤 글로 간다', async () => {
    const fetchMock = stubFetch({
      'GET /api/posts/42/working-copy': () => json(200, COPY),
      'POST /api/markdown/preview': () => json(200, { html: '' }),
      'POST /api/posts/42/publish': () =>
        json(200, {
          url: '/@na_ms/posts/42',
          publishedAt: '2026-10-07T05:10:00Z',
          firstPublicAt: null,
          editedAt: '2026-10-07T05:10:00Z',
          version: 6,
        }),
    });
    const user = userEvent.setup();
    renderEditor();
    await screen.findByLabelText('제목');

    await user.click(screen.getByRole('button', { name: '글 등록' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/다시 등록할까요/)).toBeInTheDocument();
    expect(within(dialog).queryByText('태그')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText('공개 범위')).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/공동 작업자 /)).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, 'GET', '/api/posts/42/collaborators')).toHaveLength(0);

    await user.click(within(dialog).getByRole('button', { name: '등록' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/@na_ms/posts/42'));
    const [call] = requestsTo(fetchMock, 'POST', '/api/posts/42/publish');
    const body = JSON.parse(String((call[1] as RequestInit).body));
    expect(body).toMatchObject({ tags: ['여행'], visibility: 'FRIENDS', thumbnailUrl: null });
  });

  it('[임시저장]하면 내 둥지 관리가 아니라 글로 돌아간다', async () => {
    stubFetch({
      'GET /api/posts/42/working-copy': () => json(200, COPY),
      'POST /api/markdown/preview': () => json(200, { html: '' }),
      'PUT /api/posts/42/working-copy': () =>
        json(200, { version: 6, savedAt: '2026-10-07T05:10:00Z' }),
    });
    const user = userEvent.setup();
    renderEditor();
    await screen.findByLabelText('제목');

    await user.click(screen.getByRole('button', { name: '임시저장' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/@na_ms/posts/42'));
  });
});
