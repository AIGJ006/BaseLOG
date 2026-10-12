import { describe, expect, it } from 'vitest';
import { noteId, parseNote, sortNotes } from './parseNote';

describe('parseNote', () => {
  it('머리 주석·소제목·목록·문단을 읽고 PR 번호 괄호를 숨긴다', () => {
    const note = parseNote(
      'v1.0.1',
      [
        '<!-- target: abc -->',
        '<!-- title: BaseLOG 1.0.1 배포 이후 수정사항 -->',
        '<!-- date: 2026-10-12 -->',
        '첫 배포 뒤 고친 것들이에요.',
        '',
        '### 화면 디자인',
        '- 로고를 키웠어요 (#40)',
        '- 홈 오른쪽 칸 (#40, #41)',
        '- 자동 배포 (#31, #34~#37)',
        '맺음 문단',
      ].join('\n'),
    );
    expect(note.title).toBe('BaseLOG 1.0.1 배포 이후 수정사항');
    expect(note.date).toBe('2026-10-12');
    expect(note.blocks).toEqual([
      { kind: 'paragraph', text: '첫 배포 뒤 고친 것들이에요.' },
      { kind: 'heading', text: '화면 디자인' },
      { kind: 'list', items: ['로고를 키웠어요', '홈 오른쪽 칸', '자동 배포'] },
      { kind: 'paragraph', text: '맺음 문단' },
    ]);
  });

  it('제목 주석이 없으면 id를 제목으로 쓴다', () => {
    expect(parseNote('x', '본문').title).toBe('x');
  });
});

describe('sortNotes·noteId', () => {
  it('날짜 내림차순, 같은 날은 버전 숫자 내림차순', () => {
    const notes = ['v1.0.9', 'v1.0.10', 'v1.0.0'].map((id) =>
      parseNote(id, `<!-- date: ${id === 'v1.0.0' ? '2026-10-10' : '2026-10-12'} -->`),
    );
    expect(sortNotes(notes).map((n) => n.id)).toEqual(['v1.0.10', 'v1.0.9', 'v1.0.0']);
  });

  it('파일 경로에서 id를 뗀다', () => {
    expect(noteId('./releases/v1.0.1.md')).toBe('v1.0.1');
  });
});
