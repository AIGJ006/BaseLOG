import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { SPELL_MESSAGES } from './messages';
import { replaceInTextarea } from './textareaEdit';
import type { SpellRange } from './spellRanges';
import './spellCheck.css';

/**
 * 본문 칸 뒤에 같은 글을 똑같이 배치해 고칠 곳에 빨간 물결 밑줄을 긋는다 (022 US1, spec R6).
 *
 * - 본문 칸(textarea)의 글꼴·여백·테두리 두께·크기를 그대로 옮겨 와 글자 위치가 겹치게 하고, 본문 칸 배경만 투명하게 한다.
 *   스크롤도 따라간다. 이 층은 클릭을 받지 않는다.
 * - 본문 칸에서 밑줄 친 곳을 누르거나 커서를 옮기면 그 아래에 고친 말 창([바꾸기]·[무시])을 띄운다.
 * - [바꾸기]는 브라우저 입력으로 넣어 Ctrl+Z로 되돌릴 수 있다(안 되는 환경이면 `onChange`로 새 본문을 넘긴다).
 */
interface Props {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  text: string;
  ranges: readonly SpellRange[];
  onChange: (next: string) => void;
  onIgnore: (id: string) => void;
}

const COPIED = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'textIndent',
  'textTransform',
  'paddingTop',
  'paddingLeft',
  'paddingBottom',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderRadius',
  'boxSizing',
] as const;

export default function SpellMirror({
  textareaRef,
  text,
  ranges,
  onChange,
  onIgnore,
}: Readonly<Props>) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const open = ranges.find((r) => r.id === openId) ?? null;

  /** 본문 칸 모양을 옮겨 온다 (크기가 바뀔 때마다). */
  const sync = useCallback(() => {
    const textarea = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!textarea || !mirror) return;
    const style = getComputedStyle(textarea);
    for (const key of COPIED) {
      mirror.style[key] = style[key];
    }
    const borders =
      (parseFloat(style.borderLeftWidth) || 0) + (parseFloat(style.borderRightWidth) || 0);
    // 세로 스크롤 막대만큼 오른쪽 여백을 늘려 글자 줄바꿈 자리를 맞춘다
    const scrollbar = Math.max(0, textarea.offsetWidth - textarea.clientWidth - borders);
    mirror.style.paddingRight = `${(parseFloat(style.paddingRight) || 0) + scrollbar}px`;
    mirror.style.width = `${textarea.offsetWidth}px`;
    mirror.style.height = `${textarea.offsetHeight}px`;
    mirror.style.top = `${textarea.offsetTop}px`;
    mirror.style.left = `${textarea.offsetLeft}px`;
    mirror.scrollTop = textarea.scrollTop;
  }, [textareaRef]);

  useLayoutEffect(() => {
    sync();
  });

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const onScroll = () => {
      if (mirrorRef.current) mirrorRef.current.scrollTop = textarea.scrollTop;
      setOpenId(null);
    };
    const onCaret = () => {
      const pos = textarea.selectionStart;
      if (pos !== textarea.selectionEnd) {
        setOpenId(null);
        return;
      }
      const hit = ranges.find((r) => pos >= r.start && pos <= r.end);
      setOpenId(hit ? hit.id : null);
    };
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(sync) : null;
    observer?.observe(textarea);
    textarea.addEventListener('scroll', onScroll);
    textarea.addEventListener('click', onCaret);
    textarea.addEventListener('keyup', onCaret);
    return () => {
      observer?.disconnect();
      textarea.removeEventListener('scroll', onScroll);
      textarea.removeEventListener('click', onCaret);
      textarea.removeEventListener('keyup', onCaret);
    };
  }, [textareaRef, ranges, sync]);

  // 열린 창을 밑줄 바로 아래에 둔다
  useLayoutEffect(() => {
    const mirror = mirrorRef.current;
    const wrap = mirror?.parentElement;
    const mark = open ? mirror?.querySelector<HTMLElement>(`[data-spell-id="${open.id}"]`) : null;
    if (!mirror || !wrap || !mark) {
      setPlace(null);
      return;
    }
    const w = wrap.getBoundingClientRect();
    const m = mark.getBoundingClientRect();
    const width = Math.min(288, w.width);
    setPlace({
      top: m.bottom - w.top + 6,
      left: Math.max(0, Math.min(m.left - w.left, w.width - width)),
    });
  }, [open, text]);

  const segments: (string | SpellRange)[] = [];
  let at = 0;
  for (const r of ranges) {
    if (r.start < at) continue;
    segments.push(text.slice(at, r.start), r);
    at = r.end;
  }
  segments.push(text.slice(at));

  function replace(r: SpellRange) {
    setOpenId(null);
    replaceInTextarea(textareaRef.current, text, r.start, r.end, r.suggestion, onChange);
  }

  function ignore(r: SpellRange) {
    setOpenId(null);
    onIgnore(r.id);
    textareaRef.current?.focus();
  }

  return (
    <>
      <div ref={mirrorRef} className="spell-mirror" aria-hidden="true">
        {segments.map((s) =>
          typeof s === 'string' ? (
            s
          ) : (
            <mark
              key={s.id}
              data-spell-id={s.id}
              className={s.id === openId ? 'spell-mark spell-mark--open' : 'spell-mark'}
            >
              {s.original}
            </mark>
          ),
        )}
        {/* 끝 줄바꿈도 본문 칸처럼 한 줄을 차지하게 */}
        {'​'}
      </div>
      {open && place ? (
        <div
          className="spell-popover"
          role="dialog"
          aria-label="맞춤법 제안"
          style={{ top: place.top, left: place.left }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setOpenId(null);
              textareaRef.current?.focus();
            }
          }}
        >
          <p className="spell-popover__fix">
            <del>{open.original}</del>
            <span aria-hidden="true"> → </span>
            <ins>{open.suggestion}</ins>
          </p>
          {open.reason ? <p className="spell-popover__reason">{open.reason}</p> : null}
          <div className="spell-popover__actions">
            <button type="button" className="btn btn-primary" onClick={() => replace(open)}>
              {SPELL_MESSAGES.replace}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => ignore(open)}>
              {SPELL_MESSAGES.ignore}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
