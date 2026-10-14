import type { SpellIssue } from '../../api/types/spellCheck';

/**
 * 고칠 곳을 본문 안 위치로 바꾸고, 본문이 바뀌면 위치를 옮긴다 (022 spec R5).
 *
 * - AI는 틀린 말만 돌려준다(위치는 믿지 않는다). 화면이 본문에서 그 말을 모두 찾아 밑줄을 긋는다.
 * - 코드 블록(``` · ~~~)과 인라인 코드, 링크 주소 안은 찾지 않는다 — 서버도 그 부분은 보내지 않는다.
 * - 겹치는 자리는 앞에 찾은 것만 남긴다.
 */
export interface SpellRange extends SpellIssue {
  /** 본문 안 고유 번호 (밑줄·창을 잇는다) */
  id: string;
  start: number;
  end: number;
}

/** 찾지 않을 범위 [start, end) — 코드 블록·인라인 코드·링크·사진 주소 */
export function skippedRanges(text: string): [number, number][] {
  const skipped: [number, number][] = [];
  const fence = /^[ \t]*(```|~~~)[^\n]*\n[\s\S]*?(^[ \t]*\1[ \t]*$|(?![\s\S]))/gm;
  for (const m of text.matchAll(fence)) {
    skipped.push([m.index, m.index + m[0].length]);
  }
  const inline = /`+[^`\n]*`+|\]\([^)\n]*\)|https?:\/\/\S+|<[^>\n]+>/g;
  for (const m of text.matchAll(inline)) {
    skipped.push([m.index, m.index + m[0].length]);
  }
  return skipped;
}

function overlaps(a: [number, number], start: number, end: number): boolean {
  return start < a[1] && end > a[0];
}

export function locateIssues(text: string, issues: readonly SpellIssue[]): SpellRange[] {
  const skipped = skippedRanges(text);
  const found: SpellRange[] = [];
  issues.forEach((issue, i) => {
    if (!issue.original) return;
    let from = 0;
    let n = 0;
    for (;;) {
      const start = text.indexOf(issue.original, from);
      if (start < 0) break;
      const end = start + issue.original.length;
      from = end;
      if (skipped.some((s) => overlaps(s, start, end))) continue;
      if (found.some((r) => overlaps([r.start, r.end], start, end))) continue;
      found.push({ ...issue, id: `s${i}-${n++}`, start, end });
    }
  });
  return found.sort((a, b) => a.start - b.start);
}

/**
 * 본문이 `before` → `after`로 바뀌었을 때 위치를 옮긴다. 앞뒤가 같은 부분을 빼고 바뀐 곳 하나를 찾아,
 * 그 뒤의 것은 길이 차이만큼 옮기고 바뀐 곳에 걸친 것은 버린다(직접 고쳤거나 지운 곳).
 */
export function shiftRanges(
  before: string,
  after: string,
  ranges: readonly SpellRange[],
): SpellRange[] {
  if (before === after) return [...ranges];
  let prefix = 0;
  const max = Math.min(before.length, after.length);
  while (prefix < max && before[prefix] === after[prefix]) prefix++;
  let suffix = 0;
  while (
    suffix < max - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix++;
  }
  const changedEnd = before.length - suffix;
  const delta = after.length - before.length;
  const out: SpellRange[] = [];
  for (const r of ranges) {
    if (r.end <= prefix) {
      out.push(r);
    } else if (r.start >= changedEnd) {
      out.push({ ...r, start: r.start + delta, end: r.end + delta });
    }
    // 걸친 것은 버린다
  }
  // 옮긴 자리의 글자가 그대로인지 한 번 더 본다
  return out.filter((r) => after.slice(r.start, r.end) === r.original);
}

/** 고칠 곳 모두를 한 번에 바꾼 본문 (뒤에서부터 바꿔 앞 위치가 흔들리지 않게). */
export function applyAll(text: string, ranges: readonly SpellRange[]): string {
  let out = text;
  [...ranges]
    .sort((a, b) => b.start - a.start)
    .forEach((r) => {
      out = out.slice(0, r.start) + r.suggestion + out.slice(r.end);
    });
  return out;
}
