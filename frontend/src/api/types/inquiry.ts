/** 문의·신고 응답 모양 (023 `/api/me/inquiries`·`/api/admin/inquiries`). */
export type InquiryCategory = 'BUG' | 'ACCOUNT' | 'USER_REPORT' | 'OTHER';

export type InquiryStatus = 'RECEIVED' | 'ANSWERED';

export interface Inquiry {
  id: number;
  category: InquiryCategory;
  content: string;
  /** 사용자 신고일 때 적은 블로그 주소(@ 뺀 것) */
  targetHandle: string | null;
  /** 붙인 사진 주소. 없거나 지워졌으면 null */
  imageUrl: string | null;
  status: InquiryStatus;
  /** 접수 상태면 null */
  answer: string | null;
  /** UTC ISO-8601 */
  answeredAt: string | null;
  /** UTC ISO-8601 */
  createdAt: string;
}

export interface MyInquiryList {
  items: Inquiry[];
}

export interface CreateInquiryRequest {
  category: InquiryCategory;
  content: string;
  targetHandle?: string | null;
  imageId?: number | null;
}

export interface AdminInquiry extends Inquiry {
  /** 탈퇴했으면 withdrawn true (익명 처리면 주소·닉네임 null) */
  member: { handle: string | null; nickname: string | null; withdrawn: boolean };
}

export interface AdminInquiryPage {
  items: AdminInquiry[];
  /** 다음 쪽을 부를 때 `before`로 보낸다. 끝이면 null */
  nextBefore: number | null;
}
