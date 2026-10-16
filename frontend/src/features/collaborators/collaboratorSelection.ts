import { ApiError } from '../../api/client';
import type { Collaborator } from '../../api/collaborators';

const SAVE_FAILED = '공동 작업자를 저장하지 못했어요';

/** 등록 창이 들고 있는 공동 작업자 선택 — 읽어 온 처음 목록과 지금 고른 사람. */
export interface CollaboratorSelection {
  initial: string[];
  selected: Collaborator[];
}

/** 처음과 달라졌나 (순서는 보지 않는다) — 같으면 등록 때 저장하지 않는다. */
export function selectionChanged(selection: CollaboratorSelection | null): boolean {
  if (!selection) return false;
  const now = selection.selected.map((p) => p.handle).sort();
  const before = [...selection.initial].sort();
  return now.length !== before.length || now.some((handle, i) => handle !== before[i]);
}

/** 공동 작업자 저장 실패 문구 — 400(`TOO_MANY_COLLABORATORS`·`COLLABORATOR_NOT_FRIEND`)이면 서버 문구(`errors[].message`). */
export function collaboratorErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.errors[0]?.message ?? error.message;
  }
  return SAVE_FAILED;
}
