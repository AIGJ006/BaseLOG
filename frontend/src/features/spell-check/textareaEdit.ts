/** 본문 칸 안의 글자를 바꾼다 — 되돌리기가 되도록 브라우저 입력을 먼저 쓴다. */
export function replaceInTextarea(
  textarea: HTMLTextAreaElement | null,
  text: string,
  start: number,
  end: number,
  insert: string,
  onChange: (next: string) => void,
) {
  if (textarea) {
    textarea.focus();
    textarea.setSelectionRange(start, end);
    const inserted =
      typeof document.execCommand === 'function' &&
      document.execCommand('insertText', false, insert);
    if (inserted) {
      return;
    }
  }
  onChange(text.slice(0, start) + insert + text.slice(end));
  requestAnimationFrame(() => {
    textarea?.focus();
    textarea?.setSelectionRange(start + insert.length, start + insert.length);
  });
}
