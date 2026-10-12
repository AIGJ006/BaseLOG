/**
 * 글쓰기 도구 모음의 마크다운 편집 명령 (화면 다듬기). 본문 문자열과 선택 범위를 받아
 * "어느 범위를 무엇으로 바꾸고, 바꾼 뒤 무엇을 선택할지"를 돌려준다. 실제 입력칸 반영은 `MarkdownToolbar`가 한다.
 */
export interface TextEdit {
  /** 바꿀 범위 (원래 본문 기준) */
  from: number;
  to: number;
  /** 그 범위에 넣을 글자 */
  insert: string;
  /** 바꾼 뒤 선택 범위 (새 본문 기준) */
  selectionStart: number;
  selectionEnd: number;
}

/** 선택 글자를 앞뒤 기호로 감싼다(굵게·기울임 등). 이미 감싸져 있으면 벗긴다. 선택이 없으면 자리 글자를 넣고 선택한다. */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string,
  closing: string = marker,
): TextEdit {
  const selected = value.slice(start, end);
  const before = value.slice(Math.max(0, start - marker.length), start);
  const after = value.slice(end, end + closing.length);
  if (selected && before === marker && after === closing) {
    return {
      from: start - marker.length,
      to: end + closing.length,
      insert: selected,
      selectionStart: start - marker.length,
      selectionEnd: end - marker.length,
    };
  }
  const text = selected || placeholder;
  return {
    from: start,
    to: end,
    insert: marker + text + closing,
    selectionStart: start + marker.length,
    selectionEnd: start + marker.length + text.length,
  };
}

/** 선택이 걸친 줄 전체 범위 */
function lineRange(value: string, start: number, end: number): [number, number] {
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const endSearch = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nextBreak = value.indexOf('\n', endSearch);
  return [lineStart, nextBreak === -1 ? value.length : nextBreak];
}

const BLOCK_PREFIX = /^(#{1,6} |> |- \[[ x]\] |- |\* |\d+\. )/;

/**
 * 선택한 줄마다 앞머리를 붙인다(제목·목록·인용). 모든 줄에 이미 같은 앞머리가 있으면 떼고,
 * 다른 블록 앞머리(예: 제목 → 목록)는 바꿔 단다. `prefix`가 빈 문자열이면 앞머리만 뗀다(본문으로).
 * 번호 목록은 `numbered`로 1. 2. 3. 을 매긴다.
 */
export function toggleLinePrefix(
  value: string,
  start: number,
  end: number,
  prefix: string,
  numbered = false,
): TextEdit {
  const [from, to] = lineRange(value, start, end);
  const lines = value.slice(from, to).split('\n');
  const prefixOf = (index: number) => (numbered ? `${index + 1}. ` : prefix);
  const allHave =
    prefix !== '' &&
    lines.every((line, i) => (numbered ? /^\d+\. /.test(line) : line.startsWith(prefixOf(i))));
  const next = lines.map((line, i) => {
    const bare = line.replace(BLOCK_PREFIX, '');
    if (allHave || prefix === '') {
      return bare;
    }
    return prefixOf(i) + bare;
  });
  const insert = next.join('\n');
  return {
    from,
    to,
    insert,
    selectionStart: lines.length === 1 ? from + insert.length : from,
    selectionEnd: from + insert.length,
  };
}

/** 범위 자리에 블록(구분선·코드 블록·표 등)을 앞뒤 빈 줄과 함께 넣는다. `select`는 블록 안에서 선택할 부분. */
export function insertBlock(
  value: string,
  start: number,
  end: number,
  block: string,
  select?: string,
): TextEdit {
  const before = value.slice(0, start);
  const after = value.slice(end);
  const lead =
    before === '' || before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
  const trail = after.startsWith('\n\n')
    ? ''
    : after.startsWith('\n')
      ? '\n'
      : after === ''
        ? '\n'
        : '\n\n';
  const insert = lead + block + trail;
  const offset = select ? block.indexOf(select) : -1;
  const selectionStart = start + lead.length + (offset >= 0 ? offset : block.length);
  return {
    from: start,
    to: end,
    insert,
    selectionStart,
    selectionEnd: offset >= 0 ? selectionStart + select!.length : selectionStart,
  };
}

/** 링크: 선택 글자를 링크 글자로, 주소 자리를 선택해 둔다 */
export function insertLink(value: string, start: number, end: number): TextEdit {
  const text = value.slice(start, end) || '링크 글자';
  const url = 'https://';
  const insert = `[${text}](${url})`;
  const urlStart = start + text.length + 3;
  return {
    from: start,
    to: end,
    insert,
    selectionStart: urlStart,
    selectionEnd: urlStart + url.length,
  };
}

/** 코드 블록: 선택 글자를 담아 감싼다 */
export function insertCodeBlock(value: string, start: number, end: number): TextEdit {
  const code = value.slice(start, end) || '코드를 입력하세요';
  return insertBlock(value, start, end, '```\n' + code + '\n```', code);
}

export const TABLE_TEMPLATE = '| 제목 | 제목 |\n| --- | --- |\n| 내용 | 내용 |';
