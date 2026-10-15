/**
 * 문의·신고 API (023). 내 문의는 `/api/me/inquiries`, 관리자 목록·답변은 `/api/admin/inquiries`.
 * 답변 저장은 처리 중 문의가 사라진 경우를 화면에서 안내하려고 `notFoundScreen: false`로 보낸다.
 */
import { apiGet, apiPost, apiPut } from './client';
import type {
  AdminInquiry,
  AdminInquiryPage,
  CreateInquiryRequest,
  Inquiry,
  InquiryStatus,
  MyInquiryList,
} from './types/inquiry';

export type {
  AdminInquiry,
  AdminInquiryPage,
  CreateInquiryRequest,
  Inquiry,
  InquiryCategory,
  InquiryStatus,
  MyInquiryList,
} from './types/inquiry';

export function createInquiry(request: CreateInquiryRequest): Promise<Inquiry> {
  return apiPost<Inquiry>('/api/me/inquiries', request, { notFoundScreen: false });
}

export function listMyInquiries(): Promise<MyInquiryList> {
  return apiGet<MyInquiryList>('/api/me/inquiries');
}

export function listAdminInquiries(
  status: InquiryStatus | null,
  before?: number | null,
): Promise<AdminInquiryPage> {
  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (before) params.set('before', String(before));
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return apiGet<AdminInquiryPage>(`/api/admin/inquiries${suffix}`);
}

export function getAdminInquiry(id: number): Promise<AdminInquiry> {
  return apiGet<AdminInquiry>(`/api/admin/inquiries/${id}`, { notFoundScreen: false });
}

export function answerInquiry(id: number, answer: string): Promise<AdminInquiry> {
  return apiPut<AdminInquiry>(
    `/api/admin/inquiries/${id}/answer`,
    { answer },
    { notFoundScreen: false },
  );
}
