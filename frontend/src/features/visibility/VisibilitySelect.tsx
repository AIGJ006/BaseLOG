import { useId, useState, type ChangeEvent } from 'react';
import { ApiError, type RequestOptions } from '../../api/client';
import { setVisibility, type SetVisibilityResult } from '../../api/posts';
import {
  INVALID_VISIBILITY_MESSAGE,
  optionText,
  selectableVisibilities,
  type VisibilityValue,
} from './visibilityOptions';
import { FRIENDS_PATH } from '../friends/friendMessages';
import './visibility.css';

export interface VisibilitySelectProps {
  /** 지금 값 */
  value: VisibilityValue;
  /** 값만 고르는 모드(등록 설정): 고른 값을 알린다. 서버는 부르지 않는다 */
  onChange?: (value: VisibilityValue) => void;
  /**
   * 즉시 저장 모드: 글 번호가 있으면 고르는 즉시 `PUT /api/posts/{postId}/visibility`를 부르고 응답 값으로 표시를 바꾼다
   * (다시 발행 없음, 004 FR-016).
   */
  postId?: number;
  /**
   * 즉시 저장을 부르는 쪽이 맡을 때(006 내 글 관리 — 줄 단위 처리 `useRowAction`): 고른 값을 저장하고 결과를 돌려준다. `null`이면
   * 실패를 부르는 쪽이 이미 보였다는 뜻이라 조용히 이전 값으로 되돌린다. 주면 `postId` 없이도 즉시 저장 모드다.
   */
  save?: (next: VisibilityValue) => Promise<SetVisibilityResult | null>;
  /** 즉시 저장이 성공한 뒤 */
  onSaved?: (result: SetVisibilityResult) => void;
  /**
   * 즉시 저장이 실패했을 때(400 `INVALID_VISIBILITY` 제외). 주지 않으면 서버 문구를 선택 상자 옆에 보인다. 404 `NOT_FOUND`는
   * 공통 API 클라이언트가 공통 404 화면으로 넘긴다(`requestOptions.notFoundScreen`이 `false`가 아니면).
   */
  onError?: (error: unknown) => void;
  /** 바꾸기 전 확인 (예: 비공개 → 공개 확인창). `false`면 바꾸지 않는다 */
  confirm?: (from: VisibilityValue, to: VisibilityValue) => boolean | Promise<boolean>;
  /** 즉시 저장 요청 옵션 (006 줄 단위 오류는 `{ notFoundScreen: false }`) */
  requestOptions?: RequestOptions;
  disabled?: boolean;
  /** 스크린리더용 이름 (기본 "공개 범위"). 화면에는 안 보인다: 선택지 글자("🌐 전체 공개" 등)만으로 뜻이 통한다 */
  label?: string;
  /** 친구 공개 선택지를 보이나 (기본: 보임) */
  friendsEnabled?: boolean;
  /** 서버 검증 오류 문구 (등록 설정의 `errors[field=visibility]`) */
  error?: string | null;
  /**
   * 친구가 있나 (친구 공개 선택 구현, US8-4). `false`이고 값이 친구 공개면 "아직 친구가 없어서 지금은 나만 볼 수 있어요. [친구 초대]
   * [전체 공개로 바꾸기]"를 보인다. 모르면 주지 않는다(안내 없음).
   */
  hasFriends?: boolean;
  /** [친구 초대] 주소 (001 친구 화면) */
  inviteFriendsPath?: string;
  /** 고를 수 없게 끌 값 (예: 공동 작업자가 있는 글의 나만 보기). 선택지는 보이되 흐리게 */
  disabledValues?: VisibilityValue[];
  /** 끈 값이 있을 때 선택 상자 아래에 보일 짧은 안내 */
  disabledHint?: string;
}

/** 친구 공개인데 친구가 없을 때 안내 (US8-4, FR-048) */
export const NO_FRIENDS_NOTICE = '아직 친구가 없어서 지금은 나만 볼 수 있어요.';

/**
 * 공개 범위 선택 (004 T039). 등록 설정(002)·글 상세(005)·내 글 관리(006)가 함께 쓴다.
 *
 * - 선택지: "🌐 전체 공개"·"👥 친구 공개"·"🔒 나만 보기".
 * - 즉시 저장 모드(`postId`)에서 400이면 "공개 범위를 다시 선택해 주세요"를 보이고 이전 값으로 되돌린다. 그 밖의 실패도 이전 값으로
 *   되돌리고 `onError`(없으면 서버 문구)로 넘긴다.
 * - 서버 판정이 먼저이고 이 부품은 작성자에게만 보이는 자리에 둔다(42 P-1, FR-045).
 */
export default function VisibilitySelect({
  value,
  onChange,
  postId,
  save,
  onSaved,
  onError,
  confirm,
  requestOptions,
  disabled = false,
  label = '공개 범위',
  friendsEnabled,
  error,
  hasFriends,
  inviteFriendsPath = FRIENDS_PATH,
  disabledValues = [],
  disabledHint,
}: VisibilitySelectProps) {
  const id = useId();
  const [current, setCurrent] = useState<VisibilityValue>(value);
  const [shownValue, setShownValue] = useState<VisibilityValue>(value);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 부모가 값을 바꾸면 따라간다 (렌더 중 상태 조정 — react-hooks 규칙)
  if (value !== shownValue) {
    setShownValue(value);
    setCurrent(value);
  }

  const values = selectableVisibilities(friendsEnabled);
  const choices = values.includes(current) ? values : [...values, current];

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    return apply(event.target.value as VisibilityValue);
  }

  async function apply(next: VisibilityValue) {
    const previous = current;
    if (next === previous) {
      return;
    }
    setMessage(null);
    if (confirm && !(await confirm(previous, next))) {
      setCurrent(previous);
      return;
    }
    if (postId === undefined && save === undefined) {
      setCurrent(next);
      onChange?.(next);
      return;
    }
    setCurrent(next);
    setSaving(true);
    try {
      const result = save
        ? await save(next)
        : await setVisibility(postId as number, next, requestOptions);
      if (result === null) {
        setCurrent(previous);
        return;
      }
      setCurrent(result.visibility);
      onChange?.(result.visibility);
      onSaved?.(result);
    } catch (caught) {
      setCurrent(previous);
      if (caught instanceof ApiError && caught.code === 'INVALID_VISIBILITY') {
        setMessage(INVALID_VISIBILITY_MESSAGE);
      } else if (caught instanceof ApiError && caught.status === 404) {
        onError?.(caught);
      } else if (onError) {
        onError(caught);
      } else {
        // 400이면 칸별 문구(예: 공동 작업자가 있는 글의 나만 보기)를 먼저 보인다
        setMessage(
          caught instanceof ApiError
            ? (caught.errors[0]?.message ?? caught.message)
            : '잠시 후 다시 시도해 주세요',
        );
      }
    } finally {
      setSaving(false);
    }
  }

  const shownError = message ?? error ?? null;
  return (
    <span className="visibility-select">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={current}
        disabled={disabled || saving}
        aria-invalid={shownError ? 'true' : undefined}
        aria-describedby={shownError ? `${id}-error` : undefined}
        onChange={(event) => void handleChange(event)}
      >
        {choices.map((choice) => (
          <option key={choice} value={choice} disabled={disabledValues.includes(choice)}>
            {optionText(choice)}
          </option>
        ))}
      </select>
      {current === 'FRIENDS' && hasFriends === false ? (
        <span role="status" className="visibility-select-notice">
          {NO_FRIENDS_NOTICE}{' '}
          <a href={inviteFriendsPath} target="_blank" rel="noopener noreferrer">
            친구 초대
          </a>{' '}
          <button type="button" disabled={disabled || saving} onClick={() => void apply('PUBLIC')}>
            전체 공개로 바꾸기
          </button>
        </span>
      ) : null}
      {disabledHint && disabledValues.length > 0 ? (
        <span className="visibility-select-hint">{disabledHint}</span>
      ) : null}
      {shownError ? (
        <span id={`${id}-error`} role="alert" className="visibility-select-error">
          {shownError}
        </span>
      ) : null}
    </span>
  );
}
