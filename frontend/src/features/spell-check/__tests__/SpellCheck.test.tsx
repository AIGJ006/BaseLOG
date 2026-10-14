import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../../api/client';
import type { SpellCheckResponse } from '../../../api/types/spellCheck';
import AiConsentDialog from '../../ai-suggest/AiConsentDialog';
import SpellCheckBar from '../SpellCheckBar';
import SpellMirror from '../SpellMirror';
import { applyAll } from '../spellRanges';
import { useSpellCheck, type SpellApi } from '../useSpellCheck';

const TEXT = '오늘은 할수있다고 생각했는데 안되요.';

const RESULT: SpellCheckResponse = {
  issues: [
    { original: '할수있다고', suggestion: '할 수 있다고', reason: '띄어쓰기' },
    { original: '안되요', suggestion: '안 돼요', reason: "'돼요'가 맞아요" },
  ],
  provider: 'GEMINI',
  truncated: false,
  remainingToday: 29,
};

/** 에디터 본문 칸과 같은 짜임의 시험용 화면. */
function Harness({ api, initial = TEXT }: { api: SpellApi; initial?: string }) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const spell = useSpellCheck(1, text, api);
  return (
    <div>
      <button type="button" onClick={() => void spell.request()} disabled={spell.phase !== 'idle'}>
        맞춤법 검사
      </button>
      <SpellCheckBar
        active={spell.active}
        count={spell.ranges.length}
        foundCount={spell.foundCount}
        truncated={spell.truncated}
        remainingToday={spell.remainingToday}
        message={spell.message}
        onReplaceAll={() => setText(applyAll(text, spell.ranges))}
        onClose={spell.close}
        onCloseMessage={spell.clearMessage}
      />
      <div className="spell-field">
        {spell.ranges.length > 0 ? (
          <SpellMirror
            textareaRef={ref}
            text={text}
            ranges={spell.ranges}
            onChange={setText}
            onIgnore={spell.ignore}
          />
        ) : null}
        <textarea
          ref={ref}
          aria-label="본문"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      {spell.phase === 'consent' || spell.phase === 'agreeing' ? (
        <AiConsentDialog
          busy={spell.phase === 'agreeing'}
          error={spell.consentError}
          confirmLabel="동의하고 검사하기"
          onAgree={() => void spell.agree()}
          onCancel={spell.cancelConsent}
        />
      ) : null}
    </div>
  );
}

function fakeApi(...responses: (SpellCheckResponse | Error)[]): SpellApi {
  const check = vi.fn();
  for (const r of responses) {
    if (r instanceof Error) check.mockRejectedValueOnce(r);
    else check.mockResolvedValueOnce(r);
  }
  return { check, agreeAi: vi.fn().mockResolvedValue({}) };
}

function marks(container: HTMLElement) {
  return Array.from(container.querySelectorAll('.spell-mark')).map((m) => m.textContent);
}

function caretAt(textarea: HTMLTextAreaElement, pos: number) {
  textarea.setSelectionRange(pos, pos);
  fireEvent.click(textarea);
}

describe('맞춤법 검사', () => {
  it('누르기 전에는 서버를 부르지 않고, 누르면 틀린 곳에 밑줄을 긋는다', async () => {
    const api = fakeApi(RESULT);
    const { container } = render(<Harness api={api} />);
    expect(api.check).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));

    expect(await screen.findByText('고칠 곳 2개')).toBeInTheDocument();
    expect(api.check).toHaveBeenCalledWith(1, { contentMd: TEXT });
    expect(marks(container)).toEqual(['할수있다고', '안되요']);
    expect(screen.getByText(/오늘 남은 검사 29회/)).toBeInTheDocument();
    // 글은 저절로 바뀌지 않는다
    expect(screen.getByLabelText('본문')).toHaveValue(TEXT);
  });

  it('밑줄 친 곳에 커서를 두면 고친 말이 뜨고 [바꾸기]로 바꾼다', async () => {
    const { container } = render(<Harness api={fakeApi(RESULT)} />);
    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));
    await screen.findByText('고칠 곳 2개');
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('본문');

    caretAt(textarea, TEXT.indexOf('안되요') + 1);
    const popover = await screen.findByRole('dialog', { name: '맞춤법 제안' });
    expect(popover).toHaveTextContent('안되요');
    expect(popover).toHaveTextContent('안 돼요');
    expect(popover).toHaveTextContent("'돼요'가 맞아요");

    await userEvent.click(screen.getByRole('button', { name: '바꾸기' }));

    await waitFor(() => expect(textarea).toHaveValue('오늘은 할수있다고 생각했는데 안 돼요.'));
    expect(marks(container)).toEqual(['할수있다고']);
    expect(screen.getByText('고칠 곳 1개')).toBeInTheDocument();
  });

  it('[무시]는 밑줄만 지우고, 직접 고친 곳도 밑줄이 사라진다', async () => {
    const { container } = render(<Harness api={fakeApi(RESULT)} />);
    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));
    await screen.findByText('고칠 곳 2개');
    const textarea = screen.getByLabelText<HTMLTextAreaElement>('본문');

    caretAt(textarea, 5);
    await userEvent.click(await screen.findByRole('button', { name: '무시' }));
    expect(marks(container)).toEqual(['안되요']);
    expect(textarea).toHaveValue(TEXT);

    fireEvent.change(textarea, { target: { value: TEXT.replace('안되요', '안돼요') } });
    expect(marks(container)).toEqual([]);
    expect(screen.getByText('다 고쳤어요')).toBeInTheDocument();
  });

  it('[모두 바꾸기]와 [검사 끝내기]', async () => {
    const { container } = render(<Harness api={fakeApi(RESULT, RESULT)} />);
    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));
    await userEvent.click(await screen.findByRole('button', { name: '모두 바꾸기' }));
    expect(screen.getByLabelText('본문')).toHaveValue('오늘은 할 수 있다고 생각했는데 안 돼요.');

    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));
    await screen.findByText('고칠 곳을 찾지 못했어요');
    await userEvent.click(screen.getByRole('button', { name: '검사 끝내기' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(marks(container)).toEqual([]);
  });

  it('앞부분만 검사했으면 알린다', async () => {
    render(<Harness api={fakeApi({ ...RESULT, truncated: true })} />);
    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));
    expect(await screen.findByText(/본문 앞부분만 검사했어요/)).toBeInTheDocument();
  });

  it.each([
    [
      new ApiError(503, 'AI_UNAVAILABLE', '서버 문구', [], { reason: 'FAILED' }),
      '지금은 검사할 수 없어요. 잠시 뒤 다시 시도해 주세요',
    ],
    [
      new ApiError(503, 'AI_UNAVAILABLE', '서버 문구', [], { reason: 'NOT_PUBLIC' }),
      '비공개·친구 공개 글은 지금 검사할 수 없어요',
    ],
    [
      new ApiError(429, 'AI_DAILY_LIMIT', '서버 문구', [], { resetAt: '2026-10-14T15:00:00Z' }),
      '오늘 맞춤법 검사를 모두 썼어요. 내일 다시 써 보세요',
    ],
    [new ApiError(422, 'CONTENT_TOO_SHORT', '서버 문구', []), '검사할 내용이 없어요'],
    [new TypeError('network'), '지금은 검사할 수 없어요. 잠시 뒤 다시 시도해 주세요'],
  ])('오류 %#은 안내만 보이고 글은 그대로', async (error, message) => {
    render(<Harness api={fakeApi(error)} />);
    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.getByLabelText('본문')).toHaveValue(TEXT);
    expect(screen.getByRole('button', { name: '맞춤법 검사' })).toBeEnabled();
  });

  it('동의가 필요하면 동의 창을 띄우고, 동의하면 같은 본문으로 다시 검사한다', async () => {
    const api = fakeApi(
      new ApiError(409, 'AI_CONSENT_REQUIRED', '서버 문구', [], { version: '2026-10-14' }),
      RESULT,
    );
    render(<Harness api={api} />);
    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));
    await userEvent.click(await screen.findByRole('button', { name: '동의하고 검사하기' }));

    expect(await screen.findByText('고칠 곳 2개')).toBeInTheDocument();
    expect(api.agreeAi).toHaveBeenCalledWith('2026-10-14');
    expect(api.check).toHaveBeenCalledTimes(2);
    expect(api.check).toHaveBeenLastCalledWith(1, { contentMd: TEXT });
  });

  it('동의 창 [취소]는 아무것도 보내지 않는다', async () => {
    const api = fakeApi(new ApiError(409, 'AI_CONSENT_REQUIRED', '서버 문구', [], {}));
    render(<Harness api={api} />);
    await userEvent.click(screen.getByRole('button', { name: '맞춤법 검사' }));
    await userEvent.click(await screen.findByRole('button', { name: '취소' }));
    expect(api.agreeAi).not.toHaveBeenCalled();
    expect(api.check).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
