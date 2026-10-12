import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  getSocialProviders,
  login,
  popSocialLoginError,
  socialLoginUrl,
  type SocialProvider,
} from '../api/auth';
import { formatWait } from '../features/auth/fieldErrors';
import { redirectFromSearch } from '../features/auth/safeRedirect';
import { RESTORE_PATH } from '../features/auth-gate/authGate';
import '../features/auth/auth.css';

const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않아요';
const UNAVAILABLE_MESSAGE = '잠시 후 다시 시도해 주세요';
const SOCIAL_LABEL: Record<SocialProvider, string> = {
  GOOGLE: 'Google로 계속하기',
  GITHUB: 'GitHub로 계속하기',
};

/** 소셜 단추 앞 표시 (글자색 한 가지 — 색 값은 tokens.css 밖에 쓰지 않는다) */
const SOCIAL_ICON: Record<SocialProvider, ReactNode> = {
  GOOGLE: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.57-2.47C16.68 3.7 14.55 2.75 12 2.75 6.9 2.75 2.75 6.9 2.75 12S6.9 21.25 12 21.25c5.34 0 8.88-3.75 8.88-9.04 0-.6-.07-1.06-.15-1.51Z"
      />
    </svg>
  ),
  GITHUB: (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2.5a9.5 9.5 0 0 0-3 18.52c.47.09.65-.2.65-.46v-1.6c-2.64.57-3.2-1.27-3.2-1.27-.43-1.1-1.06-1.4-1.06-1.4-.86-.59.07-.58.07-.58.95.07 1.45.98 1.45.98.85 1.45 2.22 1.03 2.76.79.09-.62.33-1.03.6-1.27-2.1-.24-4.32-1.05-4.32-4.68 0-1.03.37-1.88.98-2.54-.1-.24-.43-1.21.09-2.52 0 0 .8-.26 2.62.97a9.1 9.1 0 0 1 4.77 0c1.82-1.23 2.62-.97 2.62-.97.52 1.31.19 2.28.1 2.52.6.66.97 1.5.97 2.54 0 3.64-2.22 4.44-4.33 4.67.34.3.65.88.65 1.78v2.64c0 .26.17.56.66.46A9.5 9.5 0 0 0 12 2.5Z"
      />
    </svg>
  ),
};

/**
 * 로그인 화면 (07 §5·§6, FR-030·034~039).
 *
 * - 이메일 로그인: 실패 문구는 어느 칸이 틀렸는지 알리지 않는다. 성공하면 전체 새로 고침으로 이동하되 `replace`로 로그인 화면을 방문 기록에서 뺀다(뒤로가기로 다시 오지 않게) — 로그인하면 세션 ID와
 *   CSRF 토큰이 바뀌므로 앱을 새로 띄워 다시 받는다.
 * - 돌아갈 곳: 다른 화면이 보낸 `?returnTo=`(또는 `?redirect=`)를 `safeRedirect`로 검사해 서버에 `redirect`로 넘긴다.
 *   서버도 같은 검사를 다시 한다(R-33).
 * - 소셜 로그인: 앱 키가 설정된 제공자만 버튼을 보인다. `/oauth2/authorization/{id}?redirect=…`로 전체 페이지 이동.
 *   콜백이 실패하면 `?error=social`로 돌아오고, 보관된 오류(정지 계정 등)를 한 번 읽어 보인다.
 * - 정지(403 `ACCOUNT_SUSPENDED`, 서버 문구에 기한·사유)·잠금(429, `Retry-After`) 문구를 보인다.
 */
export default function LoginPage() {
  const location = useLocation();
  const redirect = redirectFromSearch(location.search);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const socialError = new URLSearchParams(location.search).get('error');
  const [error, setError] = useState<string | null>(
    socialError === 'unavailable' ? UNAVAILABLE_MESSAGE : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [providers, setProviders] = useState<SocialProvider[]>([]);

  useEffect(() => {
    let active = true;
    getSocialProviders()
      .then((value) => active && setProviders(value.providers))
      .catch(() => active && setProviders([]));
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (socialError !== 'social') {
      return;
    }
    let active = true;
    popSocialLoginError()
      .then((body) => {
        if (active && body) {
          setError(body.message);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [socialError]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password, redirect);
      const target = result.redirectTo || '/';
      // 015: 탈퇴 유예 계정은 어디서 왔든 복구 화면으로 (재동의보다 먼저)
      if (result.accountStatus === 'WITHDRAWN') {
        window.location.replace(RESTORE_PATH);
        return;
      }
      window.location.replace(
        result.reagreementRequired
          ? target === '/'
            ? '/reagree'
            : `/reagree?returnTo=${encodeURIComponent(target)}`
          : target,
      );
    } catch (caught) {
      setPassword('');
      setError(messageOf(caught));
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page auth-page--login">
      <h1>로그인</h1>
      <p className="auth-lead">생각을 기록하고 나누는 블로그, BaseLOG예요.</p>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="field">
          <label htmlFor="login-email">이메일</label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">비밀번호</label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <button type="submit" className="primary" disabled={submitting}>
          이메일로 로그인
        </button>
      </form>
      <p className="auth-alt auth-alt--center">
        <Link to="/forgot-password">비밀번호 찾기</Link>
        <span aria-hidden="true"> · </span>
        <Link to="/signup">회원 가입</Link>
      </p>
      {providers.length > 0 && (
        <>
          <p className="auth-divider">
            <span>또는</span>
          </p>
          <div className="social-login">
            {providers.map((provider) => (
              <a
                key={provider}
                href={socialLoginUrl(provider, redirect)}
                onClick={(event) => {
                  if (
                    event.button !== 0 ||
                    event.metaKey ||
                    event.ctrlKey ||
                    event.shiftKey ||
                    event.altKey
                  ) {
                    return;
                  }
                  // 로그인 화면을 방문 기록에서 빼서 로그인한 뒤 뒤로가기로 다시 오지 않게 한다
                  event.preventDefault();
                  window.location.replace(socialLoginUrl(provider, redirect));
                }}
              >
                {SOCIAL_ICON[provider]}
                {SOCIAL_LABEL[provider]}
              </a>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

function messageOf(caught: unknown): string {
  if (!(caught instanceof ApiError) || caught.status === 401) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  if (caught.code === 'LOGIN_TEMPORARILY_LOCKED' && caught.retryAfter !== null) {
    return `${caught.message} (${formatWait(caught.retryAfter)} 뒤 다시 시도할 수 있어요)`;
  }
  return caught.message;
}
