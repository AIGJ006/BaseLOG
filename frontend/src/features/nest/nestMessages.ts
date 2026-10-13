import type { AttendanceResult, NestLook } from '../../api/nest';
import type { ToastMessage } from '../../components/Toast';

/** 내 둥지 꾸미기 화면 주소 (계정 메뉴·둥지 화면 링크) */
export const NEST_PAGE_PATH = '/nest';

/**
 * 꾸미기(포인트·상점)를 열었나. 2026-10-13 민서 "꾸미기 없이 1234단계만 올려줘 일단" — 지금은 새 키우기만 보인다.
 * 닫혀 있어도 서버는 포인트를 계속 쌓는다(열면 그동안 모은 포인트로 바로 산다). 열 때 `true`로.
 */
export const NEST_SHOP_OPEN = false;

/** 계정 메뉴·화면 제목 */
export const NEST_PAGE_TITLE = NEST_SHOP_OPEN ? '내 둥지 꾸미기' : '내 새 키우기';

/** 둥지 화면 오른쪽 칸의 링크 글자 */
export const NEST_LINK_TEXT = NEST_SHOP_OPEN ? '둥지 꾸미기' : '새 키우기';

/** 꾸미기가 닫혀 있으면 기본 숲·기본 둥지에 새만 보인다 */
export function shownLook<T extends Pick<NestLook, 'background' | 'nestType' | 'decorations'>>(
  look: T,
  shopOpen = NEST_SHOP_OPEN,
): T {
  return shopOpen
    ? look
    : { ...look, background: 'bg-basic', nestType: 'nest-basic', decorations: [] };
}

/** 출석 알림 — 오늘 처음 출석했을 때만. 새가 자랐으면 함께 알린다. 꾸미기가 닫혀 있으면 포인트는 말하지 않는다. */
export function attendanceToast(
  result: AttendanceResult,
  shopOpen = NEST_SHOP_OPEN,
): ToastMessage | null {
  if (!result.attended) {
    return null;
  }
  const grew = result.grew ? ` · 새가 ${result.me.nest.levelName}로 자랐어요` : '';
  return { text: shopOpen ? `출석했어요 +${result.pointsGained}${grew}` : `출석했어요${grew}` };
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
  { kind: 'PROP', label: '소품' },
] as const;
