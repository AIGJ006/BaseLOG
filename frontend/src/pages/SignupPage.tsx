import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, type FieldError } from '../api/client';
import {
  getCurrentAgreements,
  signup,
  type CurrentAgreements,
  type SignupCodeVerification,
  type SignupResult,
} from '../api/auth';
import AvailabilityHint from '../components/AvailabilityHint';
import EmailCodeVerifier from '../features/auth/EmailCodeVerifier';
import HandleInput from '../components/HandleInput';
import NicknameInput from '../components/NicknameInput';
import PasswordRuleChecklist from '../components/PasswordRuleChecklist';
import { groupFieldErrors, stripActionLabels } from '../features/auth/fieldErrors';
import SocialButtons from '../features/auth/SocialButtons';
import { useSocialProviders } from '../features/auth/useSocialProviders';
import { useSession } from '../features/auth/useSession';
import '../features/auth/auth.css';

const AGREEMENT_REQUIRED_MESSAGE = '이용약관과 개인정보 처리방침에 동의해 주세요';

type FieldName = 'email' | 'handle' | 'password' | 'passwordConfirm' | 'nickname' | 'agreements';

/**
 * 이메일 가입 화면 (07 §3, FR-002~005·010·013·014). 서버가 모든 칸 오류를 한 번에 돌려주면 칸마다 보인다.
 * 이메일은 6자리 코드로 먼저 확인해야 [가입하기]가 켜진다(2026-10-14) — 가입하면 바로 인증된 계정이다.
 * 블로그 주소는 이메일 앞부분으로 미리 채우고(직접 고치면 멈춤), 주소·닉네임은 입력이 멈추면 사용 가능 여부를 묻는다(US3).
 */
export default function SignupPage() {
  const { refresh } = useSession();
  const [agreements, setAgreements] = useState<CurrentAgreements | null>(null);
  const [agreementsFailed, setAgreementsFailed] = useState(false);
  const [email, setEmail] = useState('');
  const [verification, setVerification] = useState<SignupCodeVerification | null>(null);
  const verifiedEmail = verification?.email ?? null;
  const [handle, setHandle] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [nickname, setNickname] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldError[]>>({});
  const [handleSuggestion, setHandleSuggestion] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<SignupResult | null>(null);
  // 가입 방법 고르기: 처음엔 [이메일로 가입]·소셜 단추만, 이메일을 고르면 양식을 펼친다. 소셜 제공자가 없으면 바로 양식.
  const providers = useSocialProviders();
  const [emailChosen, setEmailChosen] = useState(false);

  useEffect(() => {
    getCurrentAgreements()
      .then(setAgreements)
      .catch(() => setAgreementsFailed(true));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setHandleSuggestion(null);
    if (!agreeTerms || !agreePrivacy) {
      setFieldErrors({
        agreements: [
          { field: 'agreements', code: 'AGREEMENT_REQUIRED', message: AGREEMENT_REQUIRED_MESSAGE },
        ],
      });
      return;
    }
    if (!agreements) {
      setFormError('약관 정보를 불러오지 못했어요. 새로 고친 뒤 다시 시도해 주세요');
      return;
    }
    if (!verification) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await signup({
        email: verification.email,
        handle,
        password,
        passwordConfirm,
        nickname,
        agreements: {
          termsVersion: agreements.terms.version,
          privacyVersion: agreements.privacy.version,
        },
        signupToken: verification.token,
      });
      setFieldErrors({});
      setDone(result);
      await refresh();
    } catch (error) {
      if (error instanceof ApiError && error.errors.length > 0) {
        setFieldErrors(groupFieldErrors(error.errors));
        // 확인한 지 1시간이 지나 토큰이 사라졌으면 코드를 다시 받게 한다
        if (error.errors.some((e) => e.code === 'EMAIL_NOT_VERIFIED')) {
          setVerification(null);
        }
        const suggestion = error.details?.handleSuggestion;
        setHandleSuggestion(typeof suggestion === 'string' ? suggestion : null);
      } else {
        setFieldErrors({});
        setFormError(error instanceof ApiError ? error.message : '잠시 후 다시 시도해 주세요');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <main className="auth-page">
        <h1>가입을 마쳤어요</h1>
        <p>
          <strong>{verifiedEmail}</strong>(으)로 가입했어요. 이제 글쓰기·댓글·사진 올리기를 바로 할
          수 있어요.
        </p>
        <p>
          둥지 주소: <code>{done.handle}</code> · 닉네임: {done.nickname}
        </p>
        <p>
          <Link to="/">홈으로</Link>
        </p>
      </main>
    );
  }

  const errorsOf = (field: FieldName) => fieldErrors[field] ?? [];
  const describedBy = (field: FieldName, extra?: string) =>
    [errorsOf(field).length > 0 ? `${field}-error` : null, extra].filter(Boolean).join(' ') ||
    undefined;

  function renderErrors(field: FieldName) {
    const errors = errorsOf(field);
    if (errors.length === 0) {
      return null;
    }
    return (
      <div id={`${field}-error`} className="field-error">
        {errors.map((error) => (
          <p key={error.code}>
            {stripActionLabels(error.message)}
            {error.code === 'EMAIL_ALREADY_REGISTERED' && (
              <>
                {' '}
                <Link to="/login">로그인</Link> <Link to="/forgot-password">비밀번호 찾기</Link>
              </>
            )}
            {/* 015: 같은 이메일 계정이 탈퇴 유예 중 — 로그인하면 복구 화면으로 간다 */}
            {error.code === 'EMAIL_WITHDRAWAL_PENDING' && (
              <>
                {' '}
                <Link to="/login">로그인</Link>
              </>
            )}
          </p>
        ))}
        {field === 'handle' && handleSuggestion && (
          <button type="button" className="link-button" onClick={() => setHandle(handleSuggestion)}>
            {handleSuggestion} 쓰기
          </button>
        )}
      </div>
    );
  }

  return (
    <main className="auth-page">
      <h1>회원 가입</h1>
      {providers === null ? null : !emailChosen && providers.length > 0 ? (
        <>
          <p className="auth-lead">가입 방법을 골라 주세요</p>
          <SocialButtons providers={providers} variant="signup">
            <button
              type="button"
              className="signup-email-choice"
              onClick={() => setEmailChosen(true)}
            >
              {MAIL_ICON}
              이메일로 가입하기
            </button>
          </SocialButtons>
          <p className="auth-alt auth-alt--center">
            이미 계정이 있나요? <Link to="/login">로그인하기</Link>
          </p>
        </>
      ) : (
        renderForm()
      )}
    </main>
  );

  function renderForm() {
    return (
      <>
        {providers && providers.length > 0 && (
          <p className="auth-alt">
            <button type="button" className="link-button" onClick={() => setEmailChosen(false)}>
              ← 다른 방법으로 가입
            </button>
          </p>
        )}
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <div className="field">
            <EmailCodeVerifier
              idPrefix="signup"
              email={email}
              onEmailChange={(value) => {
                setEmail(value);
                if (fieldErrors.email) {
                  setFieldErrors((prev) => withEmailErrors(prev, []));
                }
              }}
              verifiedEmail={verifiedEmail}
              onVerifiedChange={setVerification}
              onEmailErrors={(errors) => setFieldErrors((prev) => withEmailErrors(prev, errors))}
              emailInvalid={errorsOf('email').length > 0}
              emailDescribedBy={describedBy('email')}
            />
            {renderErrors('email')}
          </div>

          <div className="field">
            <HandleInput
              id="signup-handle"
              label="둥지 주소"
              value={handle}
              onChange={setHandle}
              sourceEmail={email}
              invalid={errorsOf('handle').length > 0}
              describedBy={describedBy('handle')}
            />
            <AvailabilityHint kind="handle" value={handle} onSuggestion={setHandle} />
            {renderErrors('handle')}
          </div>

          <div className="field">
            <label htmlFor="signup-password">비밀번호</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={errorsOf('password').length > 0}
              aria-describedby={describedBy('password', 'signup-password-rules')}
            />
            <PasswordRuleChecklist id="signup-password-rules" password={password} />
            {renderErrors('password')}
          </div>

          <div className="field">
            <label htmlFor="signup-password-confirm">비밀번호 확인</label>
            <input
              id="signup-password-confirm"
              type="password"
              autoComplete="new-password"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              aria-invalid={errorsOf('passwordConfirm').length > 0}
              aria-describedby={describedBy('passwordConfirm')}
            />
            {renderErrors('passwordConfirm')}
          </div>

          <div className="field">
            <NicknameInput
              id="signup-nickname"
              value={nickname}
              onChange={setNickname}
              invalid={errorsOf('nickname').length > 0}
              describedBy={describedBy('nickname')}
            />
            <AvailabilityHint kind="nickname" value={nickname} />
            {renderErrors('nickname')}
          </div>

          <fieldset className="field agreements" aria-describedby={describedBy('agreements')}>
            <legend>약관 동의 (필수)</legend>
            <div className="check">
              <input
                id="signup-agree-terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <label htmlFor="signup-agree-terms">이용약관에 동의해요 (필수)</label>{' '}
              <Link to="/terms" target="_blank" rel="noopener">
                이용약관
              </Link>
            </div>
            <div className="check">
              <input
                id="signup-agree-privacy"
                type="checkbox"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
              />
              <label htmlFor="signup-agree-privacy">개인정보 처리방침에 동의해요 (필수)</label>{' '}
              <Link to="/privacy" target="_blank" rel="noopener">
                처리방침 보기
              </Link>
            </div>
            {agreementsFailed && (
              <p className="field-error">약관 정보를 불러오지 못했어요. 새로 고쳐 주세요</p>
            )}
            {renderErrors('agreements')}
          </fieldset>

          {formError && (
            <p role="alert" className="form-error">
              {formError}
            </p>
          )}

          {!verifiedEmail && (
            <p id="signup-submit-help" className="field-help">
              이메일 인증 코드를 확인하면 가입할 수 있어요
            </p>
          )}
          <button
            type="submit"
            className="primary"
            disabled={submitting || !verifiedEmail}
            data-waiting={!verifiedEmail}
            aria-describedby={verifiedEmail ? undefined : 'signup-submit-help'}
          >
            가입하기
          </button>
        </form>
        <p className="auth-alt">
          이미 계정이 있나요? <Link to="/login">로그인하기</Link>
        </p>
      </>
    );
  }
}

/** 이메일 칸 오류만 바꾼다(빈 목록이면 지운다). */
function withEmailErrors(
  prev: Record<string, FieldError[]>,
  errors: FieldError[],
): Record<string, FieldError[]> {
  const next = { ...prev };
  if (errors.length > 0) {
    next.email = errors;
  } else {
    delete next.email;
  }
  return next;
}

/** [이메일로 가입하기] 앞 편지 표시 (글자색 한 가지) */
const MAIL_ICON = (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinejoin="round"
      d="M3.5 6.5h17v11h-17zM3.5 6.5l8.5 6.5 8.5-6.5"
    />
  </svg>
);
