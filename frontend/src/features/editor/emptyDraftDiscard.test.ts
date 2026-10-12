import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cancelEmptyDraftDiscard,
  isUntouchedNewDraft,
  scheduleEmptyDraftDiscard,
} from './emptyDraftDiscard';

const untouched = {
  draft: true,
  openedVersion: 0,
  title: '',
  contentMd: '',
  hasUnsent: false,
  attachments: 0,
  leaving: false,
};

describe('isUntouchedNewDraft', () => {
  it('한 글자도 안 쓴 새 임시글이면 참', () => {
    expect(isUntouchedNewDraft(untouched)).toBe(true);
    expect(isUntouchedNewDraft({ ...untouched, title: '  ' })).toBe(true);
  });

  it.each([
    ['발행 글', { draft: false }],
    ['한 번이라도 저장된 글', { openedVersion: 3 }],
    ['제목이 있음', { title: '제목' }],
    ['본문이 있음', { contentMd: '본문' }],
    ['안 보낸 저장이 있음', { hasUnsent: true }],
    ['첨부파일이 있음', { attachments: 1 }],
    ['등록·임시저장으로 나가는 중', { leaving: true }],
  ])('%s이면 지우지 않는다', (_name, patch) => {
    expect(isUntouchedNewDraft({ ...untouched, ...patch })).toBe(false);
  });
});

describe('scheduleEmptyDraftDiscard', () => {
  afterEach(() => vi.useRealTimers());

  it('한 박자 뒤 지운다', () => {
    vi.useFakeTimers();
    const discard = vi.fn().mockResolvedValue(undefined);
    scheduleEmptyDraftDiscard(7, discard);
    expect(discard).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(discard).toHaveBeenCalledWith(7);
  });

  it('같은 글을 다시 열면(개발 모드 재실행) 취소한다', () => {
    vi.useFakeTimers();
    const discard = vi.fn().mockResolvedValue(undefined);
    scheduleEmptyDraftDiscard(8, discard);
    cancelEmptyDraftDiscard(8);
    vi.runAllTimers();
    expect(discard).not.toHaveBeenCalled();
  });
});
