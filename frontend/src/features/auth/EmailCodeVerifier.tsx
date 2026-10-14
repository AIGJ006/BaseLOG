import { useEffect, useRef, useState } from 'react';
import { ApiError, type FieldError } from '../../api/client';
import { sendSignupCode, verifySignupCode, type SignupCodeVerification } from '../../api/auth';
import { formatWait } from './fieldErrors';

const CODE_MINUTES = 10;

interface Props {
  /** 칸 id 앞부분 (`signup` → `signup-email`, `signup-code`) */
  idPrefix: string;
  email: string;
  onEmailChange: (value: string) => void;
  /** 코드를 확인한 이메일(소문자). 아직이면 null */
  verifiedEmail: string | null;
  /** 확인하면 이메일과 가입 요청에 실을 토큰, [변경]이면 null */
  onVerifiedChange: (verification: SignupCodeVerification | null) => void;
  /** 이메일 칸의 서버 오류(형식·이미 가입됨)는 화면이 링크와 함께 그린다 */
  onEmailErrors: (errors: FieldError[]) => void;
  emailInvalid: boolean;
  emailDescribedBy?: string;
  socialSignup?: boolean;
}

/**
 * 가입 전 이메일 인증 (2026-10-14): 이메일 칸 옆 [인증 코드 받기] → 메일로 온 6자리 숫자 입력 → [확인].
 * 확인하면 이메일 칸을 잠그고 [변경]으로만 풀 수 있다(다른 주소로 가입하려면 다시 확인).
 */
export default function EmailCodeVerifier({
  idPrefix,
  email,
  onEmailChange,
  verifiedEmail,
  onVerifiedChange,
  onEmailErrors,
  emailInvalid,
  emailDescribedBy,
  socialSignup = false,
}: Props) {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const verified = verifiedEmail !== null;
  // 응답이 오기 전에 이메일을 바꿨으면 그 응답은 버린다(바뀐 주소가 옛 주소의 확인을 물려받지 않게)
  const currentEmail = useRef(normalize(email));
  useEffect(() => {
    currentEmail.current = normalize(email);
  }, [email]);

  useEffect(() => {
    if (expiresAt === null || verified) {
      return undefined;
    }
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt, verified]);

  const remaining = expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000));

  async function send() {
    setMessage(null);
    setCodeError(null);
    onEmailErrors([]);
    setSending(true);
    const normalized = normalize(email);
    try {
      await sendSignupCode(email, socialSignup);
      if (currentEmail.current !== normalized) {
        return;
      }
      setSentTo(normalized);
      setCode('');
      setExpiresAt(Date.now() + CODE_MINUTES * 60 * 1000);
      setNow(Date.now());
      setMessage(`${normalized}(으)로 6자리 코드를 보냈어요. 메일이 없으면 스팸함도 확인해 주세요`);
    } catch (error) {
      if (currentEmail.current !== normalized) {
        return;
      }
      if (error instanceof ApiError && error.errors.length > 0) {
        onEmailErrors(error.errors);
      } else if (error instanceof ApiError && error.code === 'TOO_MANY_REQUESTS') {
        setMessage(
          error.retryAfter
            ? `코드를 너무 자주 받았어요. ${formatWait(error.retryAfter)} 뒤에 다시 받아 주세요`
            : '코드를 너무 자주 받았어요. 잠시 후 다시 받아 주세요',
        );
      } else {
        setMessage(error instanceof ApiError ? error.message : '잠시 후 다시 시도해 주세요');
      }
    } finally {
      setSending(false);
    }
  }

  async function check() {
    if (!sentTo) {
      return;
    }
    setCodeError(null);
    setChecking(true);
    const requested = sentTo;
    try {
      const { signupToken } = await verifySignupCode(requested, code);
      if (currentEmail.current !== requested) {
        return;
      }
      setMessage(null);
      onVerifiedChange({ email: requested, token: signupToken });
    } catch (error) {
      if (currentEmail.current !== requested) {
        return;
      }
      if (error instanceof ApiError && error.errors.length > 0) {
        setCodeError(error.errors[0].message);
      } else {
        setCodeError(error instanceof ApiError ? error.message : '잠시 후 다시 시도해 주세요');
      }
    } finally {
      setChecking(false);
    }
  }

  function changeEmail() {
    onVerifiedChange(null);
    setSentTo(null);
    setExpiresAt(null);
    setCode('');
    setMessage(null);
    setCodeError(null);
  }

  const emailId = `${idPrefix}-email`;
  const codeId = `${idPrefix}-code`;
  const statusId = `${idPrefix}-email-status`;
  const describedBy = [emailDescribedBy, message || verified ? statusId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <>
      <label htmlFor={emailId}>이메일</label>
      <div className="email-code-row">
        <input
          id={emailId}
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          readOnly={verified}
          onChange={(e) => {
            onEmailChange(e.target.value);
            if (sentTo && normalize(e.target.value) !== sentTo) {
              setSentTo(null);
              setExpiresAt(null);
              setMessage(null);
              setCodeError(null);
            }
          }}
          aria-invalid={emailInvalid}
          aria-describedby={describedBy || undefined}
        />
        {verified ? (
          <button type="button" className="secondary" onClick={changeEmail}>
            변경
          </button>
        ) : (
          <button
            type="button"
            className="secondary"
            onClick={send}
            disabled={sending || email.trim() === ''}
          >
            {sentTo ? '다시 받기' : '인증 코드 받기'}
          </button>
        )}
      </div>

      {verified ? (
        <p id={statusId} className="email-code-done">
          ✓ 이메일을 확인했어요
        </p>
      ) : (
        message && (
          <p id={statusId} className="field-help" role="status">
            {message}
          </p>
        )
      )}

      {!verified && sentTo && (
        <div className="email-code-entry">
          <label htmlFor={codeId}>인증 코드</label>
          <div className="email-code-row">
            <input
              id={codeId}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="6자리 숫자"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (code.length === 6) {
                    void check();
                  }
                }
              }}
              aria-invalid={codeError !== null}
              aria-describedby={`${codeId}-help${codeError ? ` ${codeId}-error` : ''}`}
            />
            <button
              type="button"
              className="secondary"
              onClick={check}
              disabled={checking || code.length !== 6}
            >
              확인
            </button>
          </div>
          <p id={`${codeId}-help`} className="field-help">
            {remaining > 0
              ? `남은 시간 ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
              : '코드가 만료됐어요. [다시 받기]를 눌러 주세요'}
          </p>
          {codeError && (
            <div id={`${codeId}-error`} className="field-error">
              <p>{codeError}</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
