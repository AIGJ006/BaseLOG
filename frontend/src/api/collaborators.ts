/**
 * 글 공동 작업자 API. 작성자만 읽고 바꾼다(남이면 404). 공동 작업자는 그 발행 글의 제목·본문만 고쳐 다시 등록할 수 있다.
 * 404여도 공통 404 화면으로 넘기지 않는다 — 등록 창 안의 한 칸이라 그 자리에서만 알린다.
 */
import { apiGet, apiPut } from './client';
import type { AuthorSummary } from './types/reading';

/** 한 글에 고를 수 있는 공동 작업자 수 (서버 `TOO_MANY_COLLABORATORS`와 같은 값). */
export const MAX_COLLABORATORS = 3;

export type Collaborator = AuthorSummary;

export interface CollaboratorList {
  items: Collaborator[];
}

export function getCollaborators(postId: number): Promise<CollaboratorList> {
  return apiGet<CollaboratorList>(`/api/posts/${postId}/collaborators`, { notFoundScreen: false });
}

/** 목록 전체를 바꾼다. 400 `TOO_MANY_COLLABORATORS`·`COLLABORATOR_NOT_FRIEND`(field `handles`). */
export function setCollaborators(postId: number, handles: string[]): Promise<CollaboratorList> {
  return apiPut<CollaboratorList>(
    `/api/posts/${postId}/collaborators`,
    { handles },
    { notFoundScreen: false },
  );
}
