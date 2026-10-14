import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../../../api/client';
import type { UploadedImage } from '../../../api/types/images';
import { json, requestsTo, stubFetch } from '../../../test/fetchRoutes';
import type { UploadResult } from '../../image-upload/uploadImage';
import InquiryForm from '../InquiryForm';

const IMAGE: UploadedImage = {
  imageId: 31,
  url: 'https://img.example.com/posts/a.webp',
  thumbUrl: 'https://img.example.com/posts/a-thumb.webp',
  contentType: 'image/webp',
  width: 100,
  height: 100,
  sizeBytes: 1000,
};

const SENT = {
  id: 1,
  category: 'BUG',
  content: '사진 보세요',
  targetHandle: null,
  imageUrl: IMAGE.url,
  status: 'RECEIVED',
  answer: null,
  answeredAt: null,
  createdAt: '2026-10-14T01:00:00Z',
};

describe('InquiryForm 사진 한 장 (023)', () => {
  beforeEach(() => {
    resetClientForTests();
    document.cookie = 'XSRF-TOKEN=t';
  });
  afterEach(() => vi.unstubAllGlobals());

  it('올린 사진 번호를 함께 보내고, [사진 빼기]로 뺄 수 있다', async () => {
    const mock = stubFetch({ 'POST /api/me/inquiries': () => json(201, SENT) });
    const upload = vi.fn(async (): Promise<UploadResult> => ({ kind: 'uploaded', image: IMAGE }));
    const onSent = vi.fn();
    const user = userEvent.setup();
    render(<InquiryForm onSent={onSent} upload={upload} />);

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    await user.upload(screen.getByTestId('inquiry-photo-input'), file);
    expect(await screen.findByRole('img', { name: '붙인 사진' })).toHaveAttribute(
      'src',
      IMAGE.thumbUrl,
    );
    expect(screen.queryByRole('button', { name: '사진 올리기' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '사진 빼기' }));
    expect(screen.queryByRole('img', { name: '붙인 사진' })).toBeNull();
    await user.upload(screen.getByTestId('inquiry-photo-input'), file);
    await screen.findByRole('img', { name: '붙인 사진' });

    await user.type(screen.getByLabelText('내용'), '사진 보세요');
    await user.click(screen.getByRole('button', { name: '보내기' }));
    await screen.findByRole('status');
    const [, init] = requestsTo(mock, 'POST', '/api/me/inquiries')[0];
    expect(JSON.parse(String(init?.body))).toMatchObject({ imageId: 31 });
    expect(onSent).toHaveBeenCalledWith(SENT);
    expect(screen.queryByRole('img', { name: '붙인 사진' })).toBeNull();
  });

  it('사진을 못 올리면 이유를 보여 준다', async () => {
    stubFetch({});
    const upload = vi.fn(async (): Promise<UploadResult> => ({
      kind: 'rejected',
      code: 'IMAGE_TOO_LARGE',
      message: '사진이 너무 커요',
    }));
    const user = userEvent.setup();
    render(<InquiryForm onSent={vi.fn()} upload={upload} />);
    await user.upload(
      screen.getByTestId('inquiry-photo-input'),
      new File(['x'], 'a.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('사진이 너무 커요');
  });

  it('2000자를 넘으면 글자 수가 빨갛고 보낼 수 없다', async () => {
    stubFetch({});
    render(<InquiryForm onSent={vi.fn()} />);
    const user = userEvent.setup();
    const content = screen.getByLabelText('내용');
    await user.click(content);
    await user.paste('가'.repeat(2001));
    expect(screen.getByText('2001/2000')).toHaveAttribute('data-over', 'true');
    expect(screen.getByRole('button', { name: '보내기' })).toBeDisabled();
  });
});
