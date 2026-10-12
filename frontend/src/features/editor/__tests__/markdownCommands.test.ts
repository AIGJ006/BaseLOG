import { describe, expect, it } from 'vitest';
import {
  insertBlock,
  insertCodeBlock,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
  type TextEdit,
} from '../markdownCommands';

function run(value: string, edit: TextEdit) {
  const next = value.slice(0, edit.from) + edit.insert + value.slice(edit.to);
  return { next, selected: next.slice(edit.selectionStart, edit.selectionEnd) };
}

/** 글쓰기 도구 모음의 마크다운 명령 (화면 다듬기) */
describe('markdownCommands', () => {
  it('굵게: 선택 글자를 감싸고 다시 누르면 벗긴다', () => {
    const value = '안녕 세상';
    const once = run(value, wrapSelection(value, 3, 5, '**', '굵은 글자'));
    expect(once.next).toBe('안녕 **세상**');
    expect(once.selected).toBe('세상');
    const twice = run(once.next, wrapSelection(once.next, 5, 7, '**', '굵은 글자'));
    expect(twice.next).toBe(value);
  });

  it('선택이 없으면 자리 글자를 넣고 선택해 둔다', () => {
    const { next, selected } = run('', wrapSelection('', 0, 0, '*', '기울인 글자'));
    expect(next).toBe('*기울인 글자*');
    expect(selected).toBe('기울인 글자');
  });

  it('제목: 줄 앞머리를 붙이고, 다른 제목이면 바꾸고, 같은 제목이면 뗀다', () => {
    const value = '첫 줄\n둘째 줄';
    const h2 = run(value, toggleLinePrefix(value, 6, 6, '## '));
    expect(h2.next).toBe('첫 줄\n## 둘째 줄');
    const h1 = run(h2.next, toggleLinePrefix(h2.next, 8, 8, '# '));
    expect(h1.next).toBe('첫 줄\n# 둘째 줄');
    const plain = run(h1.next, toggleLinePrefix(h1.next, 8, 8, '# '));
    expect(plain.next).toBe(value);
  });

  it('번호 목록은 선택한 줄마다 1. 2. 를 매긴다', () => {
    const value = '사과\n배';
    expect(run(value, toggleLinePrefix(value, 0, value.length, '1. ', true)).next).toBe(
      '1. 사과\n2. 배',
    );
  });

  it('구분선·코드 블록은 앞뒤 빈 줄과 함께 넣는다', () => {
    const value = '위\n아래';
    expect(run(value, insertBlock(value, 1, 1, '---')).next).toBe('위\n\n---\n\n아래');
    const code = run('x = 1', insertCodeBlock('x = 1', 0, 5));
    expect(code.next).toBe('```\nx = 1\n```\n');
    expect(code.selected).toBe('x = 1');
  });

  it('링크는 선택 글자를 링크 글자로 두고 주소 자리를 선택한다', () => {
    const { next, selected } = run('블로그', insertLink('블로그', 0, 3));
    expect(next).toBe('[블로그](https://)');
    expect(selected).toBe('https://');
  });
});
