/**
 * 글 첨부파일 API (018 contracts/openapi.yaml). 요청은 공용 `client.ts`를 쓴다.
 * 내려받기는 `downloadUrl`을 링크로 연다(서버가 `Content-Disposition: attachment`로 보낸다).
 */
import { apiDelete, apiGet, apiPost } from './client';

export interface Attachment {
  id: number;
  name: string;
  size: number;
  createdAt: string;
  downloadUrl: string;
}

/** 서버 설정(blog.attachment.*)과 같은 값. 화면은 미리 막는 데만 쓰고 최종 판정은 서버가 한다. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_POST = 5;
export const ATTACHMENT_EXTENSIONS = [
  'pdf',
  'txt',
  'md',
  'csv',
  'json',
  'zip',
  '7z',
  'hwp',
  'hwpx',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'ods',
  'odp',
  'rtf',
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'mp3',
  'mp4',
  'mov',
  'wav',
] as const;

export function listAttachments(postId: number | string): Promise<Attachment[]> {
  return apiGet<{ items: Attachment[] }>(`/api/posts/${postId}/attachments`, {
    notFoundScreen: false,
  }).then((body) => body.items);
}

export function uploadAttachment(postId: number, file: File): Promise<Attachment> {
  const form = new FormData();
  form.append('file', file, file.name);
  return apiPost<Attachment>(`/api/posts/${postId}/attachments`, form, { notFoundScreen: false });
}

export function deleteAttachment(postId: number, attachmentId: number): Promise<void> {
  return apiDelete(`/api/posts/${postId}/attachments/${attachmentId}`, undefined, {
    notFoundScreen: false,
  });
}
