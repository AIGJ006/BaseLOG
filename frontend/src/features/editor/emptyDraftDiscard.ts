/**
 * 아무것도 안 쓰고 나간 새 글 정리.
 *
 * [글쓰기]는 누르는 즉시 서버에 빈 임시글을 만든다(002 FR-001). 그대로 나가면 빈 임시글이 내 글 관리에 쌓이므로,
 * 에디터를 닫을 때 한 글자도 쓰지 않은 새 글이면 `DELETE /api/posts/{id}`를 보낸다. 서버는 빈 임시글을 휴지통을
 * 거치지 않고 바로 지운다(006 FR-020). 창을 닫거나 새로고침한 경우는 건드리지 않는다 — 하루 뒤 정리 작업이 맡는다(002 FR-050).
 *
 * 개발 모드(StrictMode)는 효과를 정리했다가 곧바로 다시 실행하므로, 지우기를 한 박자 미루고 같은 글이 다시 열리면 취소한다.
 */
import { trashPost } from '../../api/managePosts';

const timers = new Map<number, ReturnType<typeof setTimeout>>();

export interface EmptyDraftState {
  /** 열 때 서버 상태가 임시글이었나. */
  draft: boolean;
  /** 열 때 서버 편집 버전 (0 = 한 번도 저장 안 됨). */
  openedVersion: number;
  title: string;
  contentMd: string;
  /** 보내지 않은 자동 저장이 남았나. */
  hasUnsent: boolean;
  /** 붙인 첨부파일·올리는 중인 파일 수. */
  attachments: number;
  /** 등록·임시저장으로 나가는 중인가. */
  leaving: boolean;
}

/** 지워도 되는 빈 새 글인가. */
export function isUntouchedNewDraft(s: EmptyDraftState): boolean {
  return (
    s.draft &&
    s.openedVersion === 0 &&
    s.title.trim() === '' &&
    s.contentMd.trim() === '' &&
    !s.hasUnsent &&
    s.attachments === 0 &&
    !s.leaving
  );
}

export function scheduleEmptyDraftDiscard(
  postId: number,
  discard: (postId: number) => Promise<unknown> = trashPost,
): void {
  cancelEmptyDraftDiscard(postId);
  timers.set(
    postId,
    setTimeout(() => {
      timers.delete(postId);
      void discard(postId).catch(() => undefined);
    }, 0),
  );
}

export function cancelEmptyDraftDiscard(postId: number): void {
  const timer = timers.get(postId);
  if (timer !== undefined) {
    clearTimeout(timer);
    timers.delete(postId);
  }
}
