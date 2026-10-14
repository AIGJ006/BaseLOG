/** 022 맞춤법 검사 API 타입 (spec API). */
import type { Provider } from './tagSuggestions';

export interface SpellCheckRequest {
  /** 에디터의 지금 본문 (저장 안 된 것 포함) */
  contentMd: string;
}

export interface SpellIssue {
  /** 글에 있는 그대로의 틀린 말 */
  original: string;
  /** 고친 말 */
  suggestion: string;
  /** 짧은 이유 (없으면 빈 문자열) */
  reason: string;
}

export interface SpellCheckResponse {
  issues: SpellIssue[];
  provider: Provider;
  /** true면 "본문 앞부분만 검사했어요" */
  truncated: boolean;
  remainingToday: number;
}
