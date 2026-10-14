import { describe, expect, it } from 'vitest';
import { applyAll, locateIssues, shiftRanges } from '../spellRanges';

const ISSUE = { original: '안되요', suggestion: '안 돼요', reason: '띄어쓰기' };

describe('locateIssues', () => {
  it('같은 말을 모두 찾고 앞에서부터 늘어놓는다', () => {
    const text = '안되요. 정말 안되요. 할수있다';
    const ranges = locateIssues(text, [
      { original: '할수있다', suggestion: '할 수 있다', reason: '' },
      ISSUE,
    ]);
    expect(ranges.map((r) => [r.original, r.start, r.end])).toEqual([
      ['안되요', 0, 3],
      ['안되요', 8, 11],
      ['할수있다', 13, 17],
    ]);
    expect(new Set(ranges.map((r) => r.id)).size).toBe(3);
  });

  it('코드 블록·인라인 코드·링크 주소 안은 찾지 않는다', () => {
    const text = '안되요\n```\n안되요\n```\n`안되요` [안되요](https://a.test/안되요)';
    const ranges = locateIssues(text, [ISSUE]);
    expect(ranges.map((r) => r.start)).toEqual([0, text.indexOf('[안되요]') + 1]);
  });

  it('겹치는 자리는 앞에 찾은 것만', () => {
    const ranges = locateIssues('할수있다', [
      { original: '할수있다', suggestion: '할 수 있다', reason: '' },
      { original: '수있', suggestion: '수 있', reason: '' },
    ]);
    expect(ranges).toHaveLength(1);
  });
});

describe('shiftRanges', () => {
  const before = '가나 안되요 다라 안되요';
  const ranges = locateIssues(before, [ISSUE]);

  it('앞에 글을 넣으면 뒤로 옮긴다', () => {
    const after = '새 ' + before;
    expect(shiftRanges(before, after, ranges).map((r) => r.start)).toEqual([5, 12]);
  });

  it('밑줄 친 곳을 직접 고치면 그 자리만 사라진다', () => {
    const after = before.replace('다라 안되요', '다라 안 돼요');
    const shifted = shiftRanges(before, after, ranges);
    expect(shifted.map((r) => r.start)).toEqual([3]);
  });

  it('바뀐 게 없으면 그대로', () => {
    expect(shiftRanges(before, before, ranges)).toEqual(ranges);
  });
});

it('applyAll은 모든 자리를 바꾼다', () => {
  const text = '안되요, 할수있다, 안되요';
  const ranges = locateIssues(text, [
    ISSUE,
    { original: '할수있다', suggestion: '할 수 있다', reason: '' },
  ]);
  expect(applyAll(text, ranges)).toBe('안 돼요, 할 수 있다, 안 돼요');
});
