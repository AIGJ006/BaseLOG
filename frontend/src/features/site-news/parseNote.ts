/** 공지·업데이트 소식 글 한 편 (README.md 형식). */
export type NoteBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'paragraph'; text: string }
  /** 한 줄에 놓인 그림들. 두 장이면 전·후 비교로 나란히 보인다 */
  | { kind: 'images'; images: NoteImage[] };

/** `![설명](images/v1.3.0/이름.png)` — src는 글 파일 폴더 기준 상대 경로(siteNews.ts가 실제 주소로 바꾼다) */
export type NoteImage = { alt: string; src: string };

export type Note = {
  /** 화면 주소의 # 자리 (`releases/v1.0.1.md` → `v1.0.1`) */
  id: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  blocks: NoteBlock[];
};

const META = /^<!--\s*(\w+):\s*(.*?)\s*-->$/;
/** 항목 끝 PR 번호 괄호: " (#39)", " (#31, #34~#37)" — 사이트에서는 숨긴다 */
const PR_REFS = /\s*\((?:#\d+(?:~#\d+)?(?:,\s*)?)+\)/g;
/** 그림만 있는 줄: `![전](a.png) ![후](b.png)` */
const IMAGE_LINE = /^(?:!\[[^\]]*\]\([^)\s]+\)\s*)+$/;
const IMAGE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** 파일 이름에서 id를 뗀다. */
export function noteId(path: string): string {
  return path.replace(/^.*\//, '').replace(/\.md$/, '');
}

/**
 * `<!-- title -->`·`<!-- date -->` 머리 주석과 본문(문단·`### 소제목`·`- 목록`·그림 줄)만 읽는 작은 해석기.
 * 우리가 직접 쓰는 파일만 읽으므로 그 밖의 마크다운 문법은 글자 그대로 문단에 둔다.
 */
export function parseNote(id: string, source: string): Note {
  const meta: Record<string, string> = {};
  const blocks: NoteBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;

  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
    if (list) {
      blocks.push({ kind: 'list', items: list });
      list = null;
    }
  };

  for (const raw of source.split(/\r?\n/)) {
    const line = raw.trim();
    const metaMatch = META.exec(line);
    if (metaMatch) {
      meta[metaMatch[1]] = metaMatch[2];
    } else if (line === '') {
      flush();
    } else if (IMAGE_LINE.test(line)) {
      flush();
      const images = [...line.matchAll(IMAGE)].map(([, alt, src]) => ({ alt, src }));
      blocks.push({ kind: 'images', images });
    } else if (line.startsWith('### ')) {
      flush();
      blocks.push({ kind: 'heading', text: line.slice(4).replace(PR_REFS, '') });
    } else if (line.startsWith('- ')) {
      if (paragraph.length > 0) {
        flush();
      }
      list ??= [];
      list.push(line.slice(2).replace(PR_REFS, ''));
    } else {
      if (list) {
        flush();
      }
      paragraph.push(line.replace(PR_REFS, ''));
    }
  }
  flush();

  return { id, title: meta.title ?? id, date: meta.date ?? '', blocks };
}

/** 최신 글이 앞에 오게: 날짜 내림차순, 같은 날이면 id 내림차순(v1.0.10 > v1.0.9). */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) =>
      b.date.localeCompare(a.date) || b.id.localeCompare(a.id, undefined, { numeric: true }),
  );
}
