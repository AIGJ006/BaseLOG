import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClientForTests } from '../api/client';
import { SessionProvider } from '../features/auth/SessionProvider';
import {
  CURRENT_AGREEMENTS,
  ME,
  errorBody,
  json,
  requestsTo,
  stubFetch,
} from '../test/fetchRoutes';
import SignupPage from './SignupPage';

function renderOnly() {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <SignupPage />
      </SessionProvider>
    </MemoryRouter>,
  );
}

/** 소셜 제공자가 없으면(목록 응답 없음) 양식이 바로 펼쳐진다 — 그때까지 기다린다. */
async function renderPage() {
  renderOnly();
  await screen.findByLabelText('이메일');
}

/** 가입 인증 코드 받기·확인 응답 (테스트마다 덮어쓸 수 있다). */
const CODE_ROUTES = {
  'POST /api/auth/signup-code': () => new Response(null, { status: 202 }),
  'POST /api/auth/signup-code/verify': () => json(200, { verified: true }),
};

async function verifyEmail(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText('이메일'), email);
  await user.click(screen.getByRole('button', { name: '인증 코드 받기' }));
  await user.type(await screen.findByLabelText('인증 코드'), '123456');
  await user.click(screen.getByRole('button', { name: '확인' }));
  await screen.findByText('✓ 이메일을 확인했어요');
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await verifyEmail(user, ' Kim755030@Naver.com ');
  await user.type(screen.getByLabelText('비밀번호'), 'Blog#2026a');
  await user.type(screen.getByLabelText('비밀번호 확인'), 'Blog#2026a');
  await user.type(screen.getByLabelText('닉네임'), '김민서');
  await user.click(screen.getByLabelText(/이용약관/));
  await user.click(screen.getByLabelText(/개인정보 처리방침/));
}

beforeEach(() => {
  resetClientForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SignupPage', () => {
  it('소셜 제공자가 있으면 가입 방법 세 단추만 먼저 보이고, [이메일로 가입하기]를 누르면 양식을 펼친다', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      'GET /api/auth/social-providers': () => json(200, { providers: ['GOOGLE', 'GITHUB'] }),
    });
    const user = userEvent.setup();
    renderOnly();
    expect(await screen.findByRole('link', { name: 'Google로 가입하기' })).toHaveAttribute(
      'href',
      '/oauth2/authorization/google',
    );
    expect(screen.getByRole('link', { name: 'GitHub로 가입하기' })).toHaveAttribute(
      'href',
      '/oauth2/authorization/github',
    );
    expect(screen.queryByLabelText('이메일')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '이메일로 가입하기' }));
    expect(screen.getByLabelText('이메일')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Google로 가입하기' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← 다른 방법으로 가입' }));
    expect(screen.getByRole('link', { name: 'Google로 가입하기' })).toBeInTheDocument();
  });

  it('소셜 제공자가 없으면 고르기 없이 이메일 양식을 바로 보인다', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      'GET /api/auth/social-providers': () => json(200, { providers: [] }),
    });
    await renderPage();
    expect(screen.queryByRole('button', { name: '이메일로 가입하기' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '← 다른 방법으로 가입' })).not.toBeInTheDocument();
  });

  it('이메일로 블로그 주소를 미리 채우고, 현재 약관 버전과 함께 가입을 보낸 뒤 안내를 보인다', async () => {
    let me: Response = json(401, errorBody('LOGIN_REQUIRED', '로그인이 필요해요'));
    const fetchMock = stubFetch({
      'GET /api/me': () => me,
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      ...CODE_ROUTES,
      'POST /api/auth/signup': () => {
        me = json(200, ME);
        return json(201, { handle: 'kim755030', nickname: '김민서', emailVerified: true });
      },
    });
    const user = userEvent.setup();
    await renderPage();

    await fillForm(user);
    expect(screen.getByLabelText('둥지 주소')).toHaveValue('kim755030');
    expect(screen.getByRole('link', { name: '이용약관' })).toHaveAttribute('href', '/terms');
    await user.click(screen.getByRole('button', { name: '가입하기' }));

    expect(await screen.findByText('가입을 마쳤어요')).toBeInTheDocument();
    const [sent] = requestsTo(fetchMock, 'POST', '/api/auth/signup-code');
    expect(JSON.parse(String(sent?.[1]?.body))).toEqual({ email: 'Kim755030@Naver.com' });
    const [checked] = requestsTo(fetchMock, 'POST', '/api/auth/signup-code/verify');
    expect(JSON.parse(String(checked?.[1]?.body))).toEqual({
      email: 'kim755030@naver.com',
      code: '123456',
    });
    const [call] = requestsTo(fetchMock, 'POST', '/api/auth/signup');
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({
      email: 'kim755030@naver.com', // 코드를 확인한 주소(소문자)로 보낸다
      handle: 'kim755030',
      password: 'Blog#2026a',
      passwordConfirm: 'Blog#2026a',
      nickname: '김민서',
      agreements: { termsVersion: '2026-10-07', privacyVersion: '2026-10-07' },
    });
  });

  it('입력하는 동안 비밀번호 규칙 체크리스트를 보인다', async () => {
    stubFetch({ 'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS) });
    const user = userEvent.setup();
    await renderPage();
    await user.type(screen.getByLabelText('비밀번호'), 'abc');
    expect(screen.getByRole('list', { name: '비밀번호 규칙' })).toHaveTextContent('최대 16자');
  });

  it('서버 칸 오류를 칸마다 모두 보이고, 이미 가입된 이메일이면 로그인·비밀번호 찾기 링크를 준다', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      ...CODE_ROUTES,
      'POST /api/auth/signup': () =>
        json(
          400,
          errorBody('VALIDATION_FAILED', '입력값을 확인해 주세요', [
            {
              field: 'email',
              code: 'EMAIL_ALREADY_REGISTERED',
              message: '이미 가입된 이메일이에요. [로그인] [비밀번호 찾기]',
            },
            {
              field: 'nickname',
              code: 'NICKNAME_DUPLICATE',
              message: '이미 사용 중인 닉네임이에요',
            },
          ]),
        ),
    });
    const user = userEvent.setup();
    await renderPage();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: '가입하기' }));

    expect(await screen.findByText('이미 사용 중인 닉네임이에요')).toBeInTheDocument();
    expect(screen.getByText(/이미 가입된 이메일이에요/)).toBeInTheDocument();
    expect(screen.queryByText(/\[로그인\]/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login');
    expect(screen.getByRole('link', { name: '비밀번호 찾기' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
  });

  it('탈퇴 유예 중인 이메일이면 복구 안내와 로그인 링크를 준다 (015 FR-022)', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      ...CODE_ROUTES,
      'POST /api/auth/signup': () =>
        json(
          400,
          errorBody('VALIDATION_FAILED', '입력값을 확인해 주세요', [
            {
              field: 'email',
              code: 'EMAIL_WITHDRAWAL_PENDING',
              message: '탈퇴 신청한 계정이 있어요. 로그인하면 복구할 수 있어요',
            },
          ]),
        ),
    });
    const user = userEvent.setup();
    await renderPage();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: '가입하기' }));

    expect(
      await screen.findByText(/탈퇴 신청한 계정이 있어요. 로그인하면 복구할 수 있어요/),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: '비밀번호 찾기' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toHaveAttribute('aria-invalid', 'true');
  });

  it('블로그 주소가 이미 쓰이면 서버가 준 추천 주소를 버튼으로 넣을 수 있다', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      ...CODE_ROUTES,
      'POST /api/auth/signup': () =>
        json(
          400,
          errorBody(
            'VALIDATION_FAILED',
            '입력값을 확인해 주세요',
            [
              {
                field: 'handle',
                code: 'HANDLE_DUPLICATE',
                message: '이미 사용 중인 주소예요. `kim755030_2`는 어떠세요?',
              },
            ],
            { handleSuggestion: 'kim755030_2' },
          ),
        ),
    });
    const user = userEvent.setup();
    await renderPage();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: '가입하기' }));

    await user.click(await screen.findByRole('button', { name: 'kim755030_2 쓰기' }));
    expect(screen.getByLabelText('둥지 주소')).toHaveValue('kim755030_2');
  });

  it('필수 동의를 하지 않으면 보내지 않고 안내한다', async () => {
    const fetchMock = stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      ...CODE_ROUTES,
    });
    const user = userEvent.setup();
    await renderPage();
    await verifyEmail(user, 'kim@naver.com');
    await user.click(screen.getByRole('button', { name: '가입하기' }));

    expect(
      await screen.findByText('이용약관과 개인정보 처리방침에 동의해 주세요'),
    ).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'POST', '/api/auth/signup')).toHaveLength(0);
  });

  it('칸 오류가 아닌 실패(503 등)는 서버 문구를 그대로 알린다', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      ...CODE_ROUTES,
      'POST /api/auth/signup': () =>
        json(503, errorBody('TEMPORARILY_UNAVAILABLE', '잠시 후 다시 시도해 주세요')),
    });
    const user = userEvent.setup();
    await renderPage();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: '가입하기' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('잠시 후 다시 시도해 주세요'),
    );
  });

  it('이메일 인증 코드를 확인하기 전에는 [가입하기]를 누를 수 없다', async () => {
    stubFetch({ 'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS) });
    await renderPage();
    expect(screen.getByRole('button', { name: '가입하기' })).toBeDisabled();
    expect(screen.getByText('이메일 인증 코드를 확인하면 가입할 수 있어요')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인증 코드 받기' })).toBeDisabled();
  });

  it('코드가 틀리면 코드 칸 아래에 알리고, 맞으면 이메일을 잠그고 [변경]으로 다시 풀 수 있다', async () => {
    let attempts = 0;
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      ...CODE_ROUTES,
      'POST /api/auth/signup-code/verify': () => {
        attempts += 1;
        return attempts === 1
          ? json(
              400,
              errorBody('VALIDATION_FAILED', '입력값을 확인해 주세요', [
                { field: 'code', code: 'EMAIL_CODE_MISMATCH', message: '인증 코드가 맞지 않아요' },
              ]),
            )
          : json(200, { verified: true });
      },
    });
    const user = userEvent.setup();
    await renderPage();
    await user.type(screen.getByLabelText('이메일'), 'kim@naver.com');
    await user.click(screen.getByRole('button', { name: '인증 코드 받기' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      'kim@naver.com(으)로 6자리 코드를 보냈어요',
    );
    expect(screen.getByText(/남은 시간 (10:00|9:5\d)/)).toBeInTheDocument();
    const codeInput = screen.getByLabelText('인증 코드');
    await user.type(codeInput, '12ab34567');
    expect(codeInput).toHaveValue('123456'); // 숫자만 6자리까지
    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(await screen.findByText('인증 코드가 맞지 않아요')).toBeInTheDocument();
    expect(codeInput).toHaveAttribute('aria-invalid', 'true');

    await user.click(screen.getByRole('button', { name: '확인' }));
    expect(await screen.findByText('✓ 이메일을 확인했어요')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: '가입하기' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: '변경' }));
    expect(screen.getByLabelText('이메일')).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: '가입하기' })).toBeDisabled();
  });

  it('이미 가입된 이메일이면 코드를 받을 때 로그인·비밀번호 찾기 링크를 준다', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      'POST /api/auth/signup-code': () =>
        json(
          400,
          errorBody('VALIDATION_FAILED', '입력값을 확인해 주세요', [
            {
              field: 'email',
              code: 'EMAIL_ALREADY_REGISTERED',
              message: '이미 가입된 이메일이에요. [로그인] [비밀번호 찾기]',
            },
          ]),
        ),
    });
    const user = userEvent.setup();
    await renderPage();
    await user.type(screen.getByLabelText('이메일'), 'kim@naver.com');
    await user.click(screen.getByRole('button', { name: '인증 코드 받기' }));
    expect(await screen.findByText(/이미 가입된 이메일이에요/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '비밀번호 찾기' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.queryByLabelText('인증 코드')).not.toBeInTheDocument();
  });

  it('코드를 너무 자주 받으면 기다릴 시간을 알린다', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      'POST /api/auth/signup-code': () =>
        json(429, errorBody('TOO_MANY_REQUESTS', '잠시 후 다시 시도해 주세요'), {
          'Retry-After': '42',
        }),
    });
    const user = userEvent.setup();
    await renderPage();
    await user.type(screen.getByLabelText('이메일'), 'kim@naver.com');
    await user.click(screen.getByRole('button', { name: '인증 코드 받기' }));
    expect(await screen.findByRole('status')).toHaveTextContent(
      '코드를 너무 자주 받았어요. 42초 뒤에 다시 받아 주세요',
    );
  });

  it('가입할 때 인증 표시가 사라졌으면(EMAIL_NOT_VERIFIED) 이메일 잠금을 풀고 다시 받게 한다', async () => {
    stubFetch({
      'GET /api/agreements/current': () => json(200, CURRENT_AGREEMENTS),
      ...CODE_ROUTES,
      'POST /api/auth/signup': () =>
        json(
          400,
          errorBody('VALIDATION_FAILED', '입력값을 확인해 주세요', [
            {
              field: 'email',
              code: 'EMAIL_NOT_VERIFIED',
              message: '이메일 인증 코드를 먼저 확인해 주세요',
            },
          ]),
        ),
    });
    const user = userEvent.setup();
    await renderPage();
    await fillForm(user);
    await user.click(screen.getByRole('button', { name: '가입하기' }));
    expect(await screen.findByText('이메일 인증 코드를 먼저 확인해 주세요')).toBeInTheDocument();
    expect(screen.getByLabelText('이메일')).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: '가입하기' })).toBeDisabled();
  });
});
