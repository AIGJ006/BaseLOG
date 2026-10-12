import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { errorBody, json, requestsTo, stubFetch } from '../../../test/fetchRoutes';
import AttachmentEditorList from '../AttachmentEditorList';
import PostAttachments from '../PostAttachments';
import {
  ATTACHMENT_LIMIT,
  ATTACHMENT_TOO_LARGE,
  ATTACHMENT_TYPE,
  useAttachments,
} from '../useAttachments';

const A = {
  id: 1,
  name: '발표 자료.pdf',
  size: 2 * 1024 * 1024,
  createdAt: '2026-10-12T00:00:00Z',
  downloadUrl: '/api/posts/9/attachments/1/download',
};

function file(name: string, size: number): File {
  const f = new File(['x'], name);
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

function Harness() {
  const ref = useRef<HTMLInputElement | null>(null);
  const a = useAttachments(9, true, ref);
  return (
    <>
      <button type="button" onClick={a.openPicker}>
        첨부파일
      </button>
      <input ref={ref} {...a.inputProps} aria-label="첨부파일 고르기" />
      <AttachmentEditorList
        items={a.items}
        uploading={a.uploading}
        notice={a.notice}
        onRemove={(id) => void a.remove(id)}
        onCloseNotice={a.clearNotice}
      />
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** 글 첨부파일 화면 (018 US1~US3). */
describe('글쓰기 첨부파일', () => {
  it('고른 파일을 올리면 목록에 나오고 [삭제]로 뺀다', async () => {
    let n = 1;
    const fetchMock = stubFetch({
      'GET /api/posts/9/attachments': () => json(200, { items: [] }),
      'POST /api/posts/9/attachments': () => json(201, { ...A, id: n, name: `f${n++}.pdf` }),
      'DELETE /api/posts/9/attachments/1': () => new Response(null, { status: 204 }),
    });
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness />);

    await user.upload(screen.getByLabelText('첨부파일 고르기'), [
      file('f1.pdf', 100),
      file('f2.pdf', 100),
    ]);

    expect(await screen.findByText('f2.pdf')).toBeInTheDocument();
    expect(screen.getByText('f1.pdf')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /첨부파일 2\/5/ })).toBeInTheDocument();
    const body = requestsTo(fetchMock, 'POST', '/api/posts/9/attachments')[0][1]?.body;
    expect(body).toBeInstanceOf(FormData);

    await user.click(screen.getByRole('button', { name: 'f1.pdf 삭제' }));
    await waitFor(() => expect(screen.queryByText('f1.pdf')).not.toBeInTheDocument());
  });

  it('형식·크기는 올리기 전에 막고, 5개를 넘으면 안내한다', async () => {
    stubFetch({
      'GET /api/posts/9/attachments': () =>
        json(200, { items: [1, 2, 3, 4].map((id) => ({ ...A, id, name: `a${id}.pdf` })) }),
      'POST /api/posts/9/attachments': () => json(201, { ...A, id: 5, name: 'ok.pdf' }),
    });
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness />);
    expect(await screen.findByText('a4.pdf')).toBeInTheDocument();

    await user.upload(screen.getByLabelText('첨부파일 고르기'), file('virus.exe', 10));
    expect(await screen.findByRole('alert')).toHaveTextContent(ATTACHMENT_TYPE);

    await user.upload(screen.getByLabelText('첨부파일 고르기'), file('big.zip', 11 * 1024 * 1024));
    expect(await screen.findByRole('alert')).toHaveTextContent(ATTACHMENT_TOO_LARGE);

    await user.upload(screen.getByLabelText('첨부파일 고르기'), [
      file('ok.pdf', 10),
      file('six.pdf', 10),
    ]);
    expect(await screen.findByText('ok.pdf')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(ATTACHMENT_LIMIT);
  });

  it('서버가 거절하면 그 문구를 보여 준다', async () => {
    stubFetch({
      'GET /api/posts/9/attachments': () => json(200, { items: [] }),
      'POST /api/posts/9/attachments': () =>
        json(
          409,
          errorBody('ATTACHMENT_LIMIT_EXCEEDED', '첨부파일은 글 하나에 5개까지 올릴 수 있어요'),
        ),
    });
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness />);

    await user.upload(screen.getByLabelText('첨부파일 고르기'), file('a.pdf', 10));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '첨부파일은 글 하나에 5개까지 올릴 수 있어요',
    );
  });
});

describe('글 읽기 첨부파일', () => {
  it('파일 이름은 내려받기 링크이고 크기를 보여 준다', async () => {
    stubFetch({ 'GET /api/posts/9/attachments': () => json(200, { items: [A] }) });
    render(<PostAttachments postId={9} />);

    const link = await screen.findByRole('link', { name: '발표 자료.pdf' });
    expect(link).toHaveAttribute('href', '/api/posts/9/attachments/1/download');
    expect(link).toHaveAttribute('download', '발표 자료.pdf');
    expect(screen.getByText('2MB')).toBeInTheDocument();
  });

  it('첨부가 없거나 불러오지 못하면 아무것도 그리지 않는다', async () => {
    const fetchMock = stubFetch({});
    const { container } = render(<PostAttachments postId={9} />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
