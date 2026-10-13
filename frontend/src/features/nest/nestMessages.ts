import type { AttendanceResult } from '../../api/nest';
import type { ToastMessage } from '../../components/Toast';

/** 새 키우기 화면 주소 (계정 메뉴·둥지 화면 링크) */
export const NEST_PAGE_PATH = '/nest';

/**
 * 계정 메뉴·화면 제목·둥지 화면 링크 글자. 2026-10-13 민서: "새 키우기" 한 화면에서 꾸미기까지 한다(상점 따로 없이 꾸미기에서 바로 해금).
 */
export const NEST_PAGE_TITLE = '새 키우기';

/** 출석 알림 — 오늘 처음 출석했을 때만. 새가 자랐으면 함께 알린다. */
export function attendanceToast(result: AttendanceResult): ToastMessage | null {
  if (!result.attended) {
    return null;
  }
  const grew = result.grew ? ` · 새가 ${result.me.nest.levelName}로 자랐어요` : '';
  return { text: `출석했어요 +${result.pointsGained}${grew}` };
}

export const REASON_TEXT: Record<string, string> = {
  POST: '글 등록',
  COMMENT: '댓글',
  LIKE_RECEIVED: '받은 좋아요',
};

export const KIND_TABS = [
  { kind: 'BACKGROUND', label: '배경' },
  { kind: 'NEST', label: '둥지' },
  { kind: 'ACCESSORY', label: '새 장식' },
] as const;
