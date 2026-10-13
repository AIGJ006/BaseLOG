import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import { login, popSocialLoginError } from '../api/auth';
import SocialButtons from '../features/auth/SocialButtons';
import { formatWait } from '../features/auth/fieldErrors';
import { redirectFromSearch } from '../features/auth/safeRedirect';
import { RESTORE_PATH } from '../features/auth-gate/authGate';
import '../features/auth/auth.css';

const INVALID_CREDENTIALS_MESSAGE = '이메일 또는 비밀번호가 올바르지 않아요';
const UNAVAILABLE_MESSAGE = '잠시 후 다시 시도해 주세요';
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
      <SocialButtons redirect={redirect} placement="after" />
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
