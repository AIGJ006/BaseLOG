import { SPELL_MESSAGES } from './messages';

/**
 * 본문 칸 위 결과 줄 (022 US1·US2): 고칠 곳 수 · [모두 바꾸기] · [검사 끝내기], 앞부분만 검사했는지·남은 횟수·AI 안내.
 * 오류 문구도 여기에 보인다. 검사 중이 아니고 결과·문구가 없으면 그리지 않는다.
 */
interface Props {
  active: boolean;
  count: number;
  foundCount: number;
  truncated: boolean;
  remainingToday: number | null;
  message: string | null;
  onReplaceAll: () => void;
  onClose: () => void;
  onCloseMessage: () => void;
}

export default function SpellCheckBar({
  active,
  count,
  foundCount,
  truncated,
  remainingToday,
  message,
  onReplaceAll,
  onClose,
  onCloseMessage,
}: Readonly<Props>) {
  if (message) {
    return (
      <div className="spell-bar" role="status">
        <p className="spell-bar__summary">{message}</p>
        <button type="button" className="link-button" onClick={onCloseMessage}>
          닫기
        </button>
      </div>
    );
  }
  if (!active) {
    return null;
  }
  let summary: string = SPELL_MESSAGES.none;
  if (count > 0) {
    summary = SPELL_MESSAGES.found(count);
  } else if (foundCount > 0) {
    summary = SPELL_MESSAGES.allFixed;
  }
  const notes = [
    truncated ? SPELL_MESSAGES.truncated : null,
    count > 0 ? SPELL_MESSAGES.aiNote : null,
    remainingToday !== null ? SPELL_MESSAGES.remaining(remainingToday) : null,
  ].filter((n): n is string => n !== null);
  return (
    <div className="spell-bar" role="status">
      <p className="spell-bar__summary">
        <strong>{summary}</strong>
        {count > 0 ? (
          <span className="spell-bar__hint"> · 빨간 밑줄을 누르면 고친 말이 보여요</span>
        ) : null}
      </p>
      {notes.length > 0 ? <p className="spell-bar__note">{notes.join(' · ')}</p> : null}
      <div className="spell-bar__actions">
        {count > 0 ? (
          <button type="button" className="btn" onClick={onReplaceAll}>
            {SPELL_MESSAGES.replaceAll}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          {SPELL_MESSAGES.close}
        </button>
      </div>
    </div>
  );
}
