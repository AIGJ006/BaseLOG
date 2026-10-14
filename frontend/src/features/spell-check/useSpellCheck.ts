import { useCallback, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../api/client';
import { checkSpelling } from '../../api/spellCheck';
import { agreeAi } from '../../api/tagSuggestions';
import type { Provider } from '../../api/types/tagSuggestions';
import type { SpellCheckRequest, SpellCheckResponse } from '../../api/types/spellCheck';
import { AI_CONSENT_VERSION } from '../ai-suggest/aiConsentText';
import { SPELL_MESSAGES } from './messages';
import { locateIssues, shiftRanges, type SpellRange } from './spellRanges';

/**
 * 맞춤법 검사 상태 (022 US1·US2). [맞춤법 검사]를 누를 때만 서버를 부른다(쓰는 동안 자동 검사 없음).
 *
 * - 결과는 보낸 본문 기준으로 위치를 찾고, 그 뒤 본문이 바뀌면 `shiftRanges`로 옮긴다(직접 고친 곳은 사라진다).
 * - 409 `AI_CONSENT_REQUIRED`면 013과 같은 동의 창을 열고, 동의하면 같은 본문으로 한 번 다시 보낸다.
 * - 오류는 문구만 보이고 글쓰기에는 닿지 않는다. 글을 저절로 바꾸지 않는다.
 */
export interface SpellApi {
  check: (postId: number, body: SpellCheckRequest) => Promise<SpellCheckResponse>;
  agreeAi: (version: string) => Promise<unknown>;
}

const DEFAULT_API: SpellApi = { check: checkSpelling, agreeAi };

export type SpellPhase = 'idle' | 'loading' | 'consent' | 'agreeing';

interface State {
  phase: SpellPhase;
  /** 검사 결과가 보이는 중인가 (밑줄·결과 줄) */
  active: boolean;
  /** 위치를 잡은 본문 */
  baseText: string;
  ranges: SpellRange[];
  /** 처음 찾은 수 (다 고쳤는지 알리려고) */
  foundCount: number;
  truncated: boolean;
  provider: Provider | null;
  remainingToday: number | null;
  message: string | null;
  consentError: string | null;
}

const INITIAL: State = {
  phase: 'idle',
  active: false,
  baseText: '',
  ranges: [],
  foundCount: 0,
  truncated: false,
  provider: null,
  remainingToday: null,
  message: null,
  consentError: null,
};

export function spellErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return SPELL_MESSAGES.retryLater;
  }
  switch (error.code) {
    case 'CONTENT_TOO_SHORT':
      return SPELL_MESSAGES.tooShort;
    case 'AI_DAILY_LIMIT':
      return SPELL_MESSAGES.dailyLimit;
    case 'AI_UNAVAILABLE':
      return error.details?.reason === 'NOT_PUBLIC'
        ? SPELL_MESSAGES.notPublic
        : SPELL_MESSAGES.retryLater;
    default:
      return error.status === 403 && error.message ? error.message : SPELL_MESSAGES.retryLater;
  }
}

export function useSpellCheck(postId: number, contentMd: string, api: SpellApi = DEFAULT_API) {
  const [state, setState] = useState<State>(INITIAL);
  const pending = useRef<string | null>(null);
  const inFlight = useRef(false);

  // 본문이 바뀌면 그린 자리를 옮긴다 (그리는 동안 계산해 밑줄이 한 번도 어긋나지 않게)
  const ranges = useMemo(
    () =>
      state.baseText === contentMd
        ? state.ranges
        : shiftRanges(state.baseText, contentMd, state.ranges),
    [state.baseText, state.ranges, contentMd],
  );
  if (state.active && state.baseText !== contentMd) {
    // 다음 변화의 기준을 지금 본문으로 (렌더 중 상태 갱신 — React가 바로 다시 그린다)
    setState((s) => ({ ...s, baseText: contentMd, ranges }));
  }

  const send = useCallback(
    async (text: string) => {
      try {
        const result = await api.check(postId, { contentMd: text });
        const found = locateIssues(text, result.issues);
        setState((s) => ({
          ...s,
          phase: 'idle',
          active: true,
          baseText: text,
          ranges: found,
          foundCount: found.length,
          truncated: result.truncated,
          provider: result.provider,
          remainingToday: result.remainingToday,
          message: null,
        }));
      } catch (error) {
        if (error instanceof ApiError && error.code === 'AI_CONSENT_REQUIRED') {
          pending.current = text;
          setState((s) => ({ ...s, phase: 'consent', consentError: null }));
          return;
        }
        setState((s) => ({
          ...s,
          phase: 'idle',
          message: spellErrorMessage(error),
          remainingToday:
            error instanceof ApiError && error.code === 'AI_DAILY_LIMIT' ? 0 : s.remainingToday,
        }));
      }
    },
    [api, postId],
  );

  /** [맞춤법 검사] — 응답 전에는 다시 누를 수 없다. */
  const request = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState((s) => ({ ...s, phase: 'loading', message: null }));
    try {
      await send(contentMd);
    } finally {
      inFlight.current = false;
    }
  }, [contentMd, send]);

  /** 동의 창 [동의하고 검사하기]: `PUT {version}` 뒤 같은 본문으로 다시 보낸다. */
  const agree = useCallback(async () => {
    setState((s) => ({ ...s, phase: 'agreeing', consentError: null }));
    try {
      await api.agreeAi(AI_CONSENT_VERSION);
    } catch (error) {
      setState((s) => ({
        ...s,
        phase: 'consent',
        consentError:
          error instanceof ApiError && error.status === 400
            ? SPELL_MESSAGES.consentChanged
            : SPELL_MESSAGES.retryLater,
      }));
      return;
    }
    const text = pending.current;
    pending.current = null;
    setState((s) => ({ ...s, phase: text === null ? 'idle' : 'loading' }));
    if (text !== null) {
      inFlight.current = true;
      try {
        await send(text);
      } finally {
        inFlight.current = false;
      }
    }
  }, [api, send]);

  const cancelConsent = useCallback(() => {
    pending.current = null;
    setState((s) => ({ ...s, phase: 'idle', consentError: null }));
  }, []);

  /** [무시] — 그 자리의 밑줄만 지운다. */
  const ignore = useCallback((id: string) => {
    setState((s) => ({ ...s, ranges: s.ranges.filter((r) => r.id !== id) }));
  }, []);

  /** [검사 끝내기] — 밑줄과 결과 줄을 모두 지운다. */
  const close = useCallback(() => {
    setState((s) => ({ ...INITIAL, remainingToday: s.remainingToday }));
  }, []);

  const clearMessage = useCallback(() => setState((s) => ({ ...s, message: null })), []);

  return {
    phase: state.phase,
    active: state.active,
    ranges: state.active ? ranges : [],
    foundCount: state.foundCount,
    truncated: state.truncated,
    provider: state.provider,
    remainingToday: state.remainingToday,
    message: state.message,
    consentError: state.consentError,
    request,
    agree,
    cancelConsent,
    ignore,
    close,
    clearMessage,
  };
}
