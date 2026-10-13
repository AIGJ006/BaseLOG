import { useEffect, useState, type ReactNode } from 'react';
import { getSocialProviders, socialLoginUrl, type SocialProvider } from '../../api/auth';

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
 * 소셜 로그인·가입 단추 (로그인·회원 가입 화면이 함께 쓴다). 앱 키가 설정된 제공자만 보인다. 누르면
 * `/oauth2/authorization/{id}?redirect=…`로 전체 페이지 이동하고, 처음 온 계정이면 서버가 소셜 가입 화면으로 보낸다.
 *
 * `placement`: 로그인 화면은 이메일 양식 뒤("또는" 구분선이 단추 위), 회원 가입 화면은 양식 앞(구분선이 단추 아래).
 */
export default function SocialButtons({
  redirect = '/',
  placement,
}: {
  redirect?: string;
  placement: 'before' | 'after';
}) {
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

  if (providers.length === 0) {
    return null;
  }
  const divider = (
    <p className={placement === 'before' ? 'auth-divider auth-divider--before' : 'auth-divider'}>
      <span>{placement === 'before' ? '또는 이메일로 가입' : '또는'}</span>
    </p>
  );
  return (
    <>
      {placement === 'after' && divider}
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
              // 이 화면을 방문 기록에서 빼서 로그인한 뒤 뒤로가기로 다시 오지 않게 한다
              event.preventDefault();
              window.location.replace(socialLoginUrl(provider, redirect));
            }}
          >
            {SOCIAL_ICON[provider]}
            {SOCIAL_LABEL[provider]}
          </a>
        ))}
      </div>
      {placement === 'before' && divider}
    </>
  );
}
