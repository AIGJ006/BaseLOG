import type { ReactNode, RefObject } from 'react';
import {
  TABLE_TEMPLATE,
  insertBlock,
  insertCodeBlock,
  insertLink,
  toggleLinePrefix,
  wrapSelection,
  type TextEdit,
} from '../../features/editor/markdownCommands';

/**
 * 글쓰기 도구 모음 (화면 다듬기, 2026-10-12 민서 요청 — 네이버 블로그 글쓰기 도구 모음을 참고해 자주 쓰는 것만).
 * 윗줄은 넣기(사진·인용구·구분선·링크·소스코드·표), 아랫줄은 글자 모양(문단 종류·굵게·기울임·취소선·목록·인라인 코드).
 * 본문은 마크다운 그대로라 버튼은 마크다운 기호를 넣어 줄 뿐이다. 되돌리기(Ctrl+Z)가 되도록 브라우저 입력으로 넣는다.
 */
export interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  /** 브라우저 입력을 쓸 수 없을 때(시험 환경 등) 새 본문을 직접 넘긴다 */
  onChange: (next: string) => void;
  /** [사진] — 에디터의 사진 고르기 창 */
  onPickImage: () => void;
}

type Command = (value: string, start: number, end: number) => TextEdit;

const icon = (path: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {path}
  </svg>
);

const ICONS = {
  image: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="m21 16-5-5-8 8" />
    </>,
  ),
  quote: icon(
    <>
      <path d="M9 8H6a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v1a3 3 0 0 1-3 3" />
      <path d="M19 8h-3a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h1v1a3 3 0 0 1-3 3" />
    </>,
  ),
  divider: icon(
    <>
      <path d="M3 12h18" />
      <path d="M8 6h8M8 18h8" strokeDasharray="1 3" />
    </>,
  ),
  link: icon(
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
    </>,
  ),
  code: icon(
    <>
      <path d="m8 7-5 5 5 5M16 7l5 5-5 5" />
    </>,
  ),
  table: icon(
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16M15 4v16" />
    </>,
  ),
  bullet: icon(
    <>
      <path d="M9 6h12M9 12h12M9 18h12" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>,
  ),
  ordered: icon(
    <>
      <path d="M10 6h11M10 12h11M10 18h11" />
      <path d="M4 4.5 5 4v4M3.8 14.5c0-.8.6-1.3 1.3-1.3s1.2.5 1.2 1.1c0 1-2.5 1.9-2.5 3.2h2.6" />
    </>,
  ),
};

const INSERTS: Array<{ label: string; icon: ReactNode; command?: Command; image?: true }> = [
  { label: '사진', icon: ICONS.image, image: true },
  { label: '인용구', icon: ICONS.quote, command: (v, s, e) => toggleLinePrefix(v, s, e, '> ') },
  { label: '구분선', icon: ICONS.divider, command: (v, _s, e) => insertBlock(v, e, e, '---') },
  { label: '링크', icon: ICONS.link, command: insertLink },
  { label: '소스코드', icon: ICONS.code, command: insertCodeBlock },
  {
    label: '표',
    icon: ICONS.table,
    command: (v, _s, e) => insertBlock(v, e, e, TABLE_TEMPLATE, '제목'),
  },
];

const FORMATS: Array<{ label: string; mark: ReactNode; command: Command; className?: string }> = [
  {
    label: '굵게',
    mark: <b>B</b>,
    command: (v, s, e) => wrapSelection(v, s, e, '**', '굵은 글자'),
  },
  {
    label: '기울임',
    mark: <i>I</i>,
    command: (v, s, e) => wrapSelection(v, s, e, '*', '기울인 글자'),
  },
  {
    label: '취소선',
    mark: <s>S</s>,
    command: (v, s, e) => wrapSelection(v, s, e, '~~', '지운 글자'),
  },
  {
    label: '인라인 코드',
    mark: <code>{'</>'}</code>,
    command: (v, s, e) => wrapSelection(v, s, e, '`', 'code'),
  },
  {
    label: '글머리 목록',
    mark: ICONS.bullet,
    command: (v, s, e) => toggleLinePrefix(v, s, e, '- '),
  },
  {
    label: '번호 목록',
    mark: ICONS.ordered,
    command: (v, s, e) => toggleLinePrefix(v, s, e, '1. ', true),
  },
];

const PARAGRAPHS: Array<{ value: string; label: string }> = [
  { value: '', label: '본문' },
  { value: '# ', label: '제목 1' },
  { value: '## ', label: '제목 2' },
  { value: '### ', label: '제목 3' },
];

export default function MarkdownToolbar({
  textareaRef,
  onChange,
  onPickImage,
}: MarkdownToolbarProps) {
  const apply = (command: Command) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    const edit = command(textarea.value, textarea.selectionStart, textarea.selectionEnd);
    textarea.focus();
    textarea.setSelectionRange(edit.from, edit.to);
    // 브라우저 입력으로 넣어야 Ctrl+Z가 된다. 안 되는 환경이면 본문을 직접 바꾼다.
    const inserted =
      typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, edit.insert);
    const select = () => textarea.setSelectionRange(edit.selectionStart, edit.selectionEnd);
    if (inserted) {
      select();
    } else {
      const next = textarea.value.slice(0, edit.from) + edit.insert + textarea.value.slice(edit.to);
      onChange(next);
      // 본문을 직접 바꾸면 React가 다시 그린 뒤에 선택을 맞춘다
      requestAnimationFrame(() => {
        textarea.focus();
        select();
      });
    }
  };

  /** 커서 줄을 본문·제목으로 바꾼다. 고르기 칸은 고른 뒤 늘 "문단"로 돌아온다 */
  const onParagraph = (prefix: string) => {
    apply((v, s, e) => toggleLinePrefix(v, s, e, prefix));
  };

  return (
    <div className="md-toolbar" role="toolbar" aria-label="글쓰기 도구">
      <div className="md-toolbar-inserts">
        {INSERTS.map((item) => (
          <button
            key={item.label}
            type="button"
            className="md-insert"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => (item.image ? onPickImage() : apply(item.command!))}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className="md-toolbar-formats">
        <select
          className="md-paragraph"
          aria-label="문단 종류"
          value="none"
          onChange={(e) => {
            onParagraph(e.target.value);
          }}
        >
          <option value="none" disabled hidden>
            문단
          </option>
          {PARAGRAPHS.map((p) => (
            <option key={p.label} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="md-sep" aria-hidden="true" />
        {FORMATS.map((item) => (
          <button
            key={item.label}
            type="button"
            className="md-format"
            aria-label={item.label}
            title={item.label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => apply(item.command)}
          >
            {item.mark}
          </button>
        ))}
      </div>
    </div>
  );
}
