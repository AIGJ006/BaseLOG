/**
 * 맞춤법 검사 API (022 spec API). 실패해도 화면 전체를 바꾸지 않는다 — 404 화면 전환을 하지 않고
 * (`notFoundScreen: false`) 에디터 안에서 문구로만 알린다.
 */
import { apiPost, type RequestOptions } from './client';
import type { SpellCheckRequest, SpellCheckResponse } from './types/spellCheck';

const QUIET: RequestOptions = { notFoundScreen: false };

/** 지금 본문을 검사한다 ([맞춤법 검사]를 누를 때만). */
export function checkSpelling(
  postId: number,
  body: SpellCheckRequest,
): Promise<SpellCheckResponse> {
  return apiPost<SpellCheckResponse>(`/api/posts/${postId}/spell-check`, body, QUIET);
}
