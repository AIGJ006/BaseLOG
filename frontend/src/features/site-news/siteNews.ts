import { noteId, parseNote, sortNotes, type Note } from './parseNote';

/** 빌드할 때 `notices/*.md`·`releases/*.md`를 글자 그대로 묶어 넣는다(서버 호출 없음). */
const noticeFiles = import.meta.glob<string>('./notices/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const releaseFiles = import.meta.glob<string>('./releases/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function load(files: Record<string, string>): Note[] {
  return sortNotes(Object.entries(files).map(([path, source]) => parseNote(noteId(path), source)));
}

export const NOTICES: Note[] = load(noticeFiles);
export const RELEASES: Note[] = load(releaseFiles);
