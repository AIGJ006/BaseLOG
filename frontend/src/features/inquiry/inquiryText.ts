/** 문의·신고 문구 (023). 서버 오류 문구가 있으면 그것을 먼저 쓴다. 오류 문구 끝에 마침표를 붙이지 않는다. */
import { ApiError } from '../../api/client';
import type { InquiryCategory, InquiryStatus } from '../../api/types/inquiry';

export const SUPPORT_PATH = '/support';

export const SUPPORT_PAGE_TITLE = '문의·신고';

/** 내용 칸 최대 글자 수 (서버도 같은 값) */
export const INQUIRY_CONTENT_MAX = 2000;

/** 관리자 답변 최대 글자 수 (서버도 같은 값) */
export const INQUIRY_ANSWER_MAX = 2000;

export const CATEGORY_LABELS: Record<InquiryCategory, string> = {
  BUG: '버그 신고',
  ACCOUNT: '계정 문의',
  USER_REPORT: '사용자 신고',
  OTHER: '기타',
};

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as InquiryCategory[];

export const STATUS_LABELS: Record<InquiryStatus, string> = {
  RECEIVED: '접수',
  ANSWERED: '답변 완료',
};

export const INQUIRY_TEXT = {
  lead: '불편한 점이나 궁금한 점을 알려 주세요. 관리자가 답하면 🔔 알림으로 알려 드려요.',
  postReportHint: '글·댓글 신고는 각 글·댓글의 [신고] 버튼을 쓰면 더 빨라요.',
  categoryLabel: '종류',
  contentLabel: '내용',
  contentPlaceholder: '언제, 어디서, 어떤 일이 있었는지 적어 주시면 더 빨리 도와드릴 수 있어요',
  targetLabel: '신고할 사람 블로그 주소 (선택)',
  targetPlaceholder: '@handle',
  photoLabel: '사진 (선택, 1장)',
  photoAdd: '사진 올리기',
  photoUploading: '올리는 중…',
  photoRemove: '사진 빼기',
  photoAlt: '붙인 사진',
  submit: '보내기',
  submitting: '보내는 중…',
  sent: '문의를 보냈어요. 답이 오면 알려 드릴게요',
  contentRequired: '내용을 적어 주세요',
  contentTooLong: `내용은 ${INQUIRY_CONTENT_MAX}자까지 쓸 수 있어요`,
  myTitle: '내가 보낸 문의',
  myEmpty: '아직 보낸 문의가 없어요',
  loading: '불러오는 중…',
  loadFailed: '불러오지 못했어요',
  reload: '다시 불러오기',
  answerTitle: '답변',
  target: (handle: string) => `신고한 사람: @${handle}`,
  retryLater: '잠시 후 다시 시도해 주세요',
} as const;

/** 오류 → 화면 문구. 칸 오류가 있으면 첫 칸 문구, 429·5xx는 잠시 후 다시. */
export function inquiryErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.status >= 500) {
      return INQUIRY_TEXT.retryLater;
    }
    if (error.errors.length > 0) {
      return error.errors[0].message;
    }
    return error.message || INQUIRY_TEXT.retryLater;
  }
  return INQUIRY_TEXT.retryLater;
}
