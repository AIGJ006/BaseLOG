import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { getMyProfile, getMySettings, type MyProfile, type MySettings } from '../api/me';
import TabIcon from '../components/TabIcon';
import TermsContent from '../components/TermsContent';
import { FRIEND_REQUESTS_PATH } from '../features/friends/friendMessages';
import { useHorizontalTabs } from '../features/settings/useHorizontalTabs';
import NotificationSettingsSection from '../features/notification/NotificationSettingsSection';
import AiConsentSettings from '../features/ai-suggest/AiConsentSettings';
import ThemeSettings from '../features/theme/ThemeSettings';
import { DARK_MODE_ENABLED } from '../config';
import { useSession } from '../features/auth/useSession';
import StorageUsageBar from '../components/StorageUsageBar';
import '../features/auth/auth.css';
import '../features/settings/settings.css';
import '../features/profile/banner.css';

import ProfileSection from '../features/settings/ProfileSection';
import AccountSection from '../features/settings/AccountSection';

type SettingsTab = 'profile' | 'account' | 'display' | 'notifications' | 'terms';

/** 설정 탭 (2026-10-14 민서 요청, 왼쪽 세로 탭). `?tab=`으로 열고 기본은 프로필 */
const SETTINGS_TABS: { tab: SettingsTab; label: string; icon: ReactNode }[] = [
  {
    tab: 'profile',
    label: '프로필',
    icon: <TabIcon d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0" />,
  },
  {
    tab: 'account',
    label: '계정',
    icon: <TabIcon d="M7 11V8a5 5 0 0 1 10 0v3M5 11h14v9H5z" />,
  },
  {
    tab: 'display',
    label: '화면',
    icon: <TabIcon d="M12 3v18M12 3a9 9 0 1 0 0 18" />,
  },
  {
    tab: 'notifications',
    label: '알림',
    icon: <TabIcon d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" />,
  },
  {
    tab: 'terms',
    label: '이용약관',
    icon: <TabIcon d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  },
];

/** 다크 모드를 끈 빌드에서는 화면 탭이 빈 칸이라 뺀다(`?tab=display`도 프로필로). */
const AVAILABLE_SETTINGS_TABS = SETTINGS_TABS.filter(
  ({ tab }) => tab !== 'display' || DARK_MODE_ENABLED,
);

function parseSettingsTab(value: string | null): SettingsTab {
  return AVAILABLE_SETTINGS_TABS.some(({ tab }) => tab === value)
    ? (value as SettingsTab)
    : 'profile';
}

/**
 * 설정 화면 `/settings` (001 T122, FR-046~053·045, 11 §5·§6). 비로그인은 `/login?returnTo=%2Fsettings`로.
 *
 * - 프로필: 사진([사진 바꾸기]·[기본 이미지로] — 고른 사진은 [저장] 때 올리고 연결한다), 닉네임(30일 제한 중이면 막고 다음 변경
 *   가능일), 소개(글자 수는 코드 포인트), 블로그 주소 `@handle` 읽기 전용. [저장] 한 번에 바꾼 칸만 보내고, 실패한 칸을 모두 보인다.
 *   025 배너: [사진 바꾸기](프로필 사진과 같은 말, 2026-10-15 민서 요청) → 5:2로 보일 영역 고르기(1500×600으로 다시 그림), [배너 지우기]는 기본 배경으로. 프로필 사진처럼 [저장] 때
 *   올리고 연결한다.
 * - 계정: 이메일 읽기 전용, 로그인 수단, 직전 로그인(없으면 "첫 로그인"), 비밀번호 변경(이메일 계정만), 최근 활동 공개(바꾸면 바로 저장; 새 글 기본 공개 범위 칸은 2026-10-12 민서 요청으로 뺐다 — 새 글은 공개로 시작), 약관 링크.
 * - 화면 테마: 시스템 설정 따르기(기본)·라이트·다크 라디오(016 `ThemeSettings`, 고르면 바로 적용·이 기기에만 저장).
 * - 친구 요청·친구 목록은 친구 화면(`/friends`)으로 옮겼다(2026-10-13). 옛 주소 `/settings#friends`는 받은 요청 탭으로 보낸다.
 * - 회원 탈퇴: 계정 칸 맨 아래 [회원 탈퇴] 링크 → `/settings/withdraw` (015).
 * - 탭(2026-10-14): 프로필·계정(+사진 저장 공간)·화면·알림·이용약관(AI 동의 + 약관 본문). `?tab=account|display|notifications|terms`, 기본 프로필.
 *
 * 닉네임·소개는 React 텍스트로만 그린다(HTML로 해석하지 않음).
 */
export default function SettingsPage() {
  const { hash } = useLocation();
  if (hash === '#friends') {
    return <Navigate to={FRIEND_REQUESTS_PATH} replace />;
  }
  return <SettingsScreen />;
}

function SettingsScreen() {
  const { me, loading, refresh } = useSession();
  const [params, setParams] = useSearchParams();
  const horizontalTabs = useHorizontalTabs();
  const tab = parseSettingsTab(params.get('tab'));
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [settings, setSettings] = useState<MySettings | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const memberId = me?.memberId;

  useEffect(() => {
    if (memberId === undefined) {
      return;
    }
    let active = true;
    Promise.all([getMyProfile(), getMySettings()])
      .then(([p, s]) => {
        if (active) {
          setProfile(p);
          setSettings(s);
        }
      })
      .catch(() => active && setLoadFailed(true));
    return () => {
      active = false;
    };
  }, [memberId]);

  if (!loading && !me) {
    return <Navigate to="/login?returnTo=%2Fsettings" replace />;
  }
  if (loadFailed) {
    return (
      <main className="settings-page">
        <h1>설정</h1>
        <p role="alert">설정을 불러오지 못했어요. 새로 고쳐 주세요</p>
      </main>
    );
  }
  if (!profile || !settings) {
    return (
      <main className="settings-page" aria-busy="true">
        <h1>설정</h1>
        <p>불러오는 중이에요</p>
      </main>
    );
  }
  return (
    <main className="settings-page settings-tabs-page">
      <header className="settings-head">
        <h1>설정</h1>
        <p className="settings-lead">프로필과 계정, 화면, 알림, 이용약관을 한곳에서 관리해요.</p>
      </header>
      <div className="settings-layout">
        <div
          className="settings-nav"
          role="tablist"
          aria-label="설정"
          aria-orientation={horizontalTabs ? 'horizontal' : 'vertical'}
          onKeyDown={moveByKey}
        >
          {AVAILABLE_SETTINGS_TABS.map(({ tab: value, label, icon }) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`settings-tab-${value}`}
              aria-selected={value === tab}
              aria-controls={`settings-panel-${value}`}
              tabIndex={value === tab ? 0 : -1}
              onClick={() => selectTab(value)}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
        {/* 탭을 옮겨도 쓰던 내용(저장 전 닉네임 등)이 남도록 패널은 모두 그려 두고 고른 것만 보인다 */}
        <div className="settings-panels">
          <div {...panelProps('profile')}>
            <ProfileSection
              key={profile.handle}
              profile={profile}
              onSaved={(saved) => {
                setProfile(saved);
                void refresh();
              }}
            />
          </div>
          <div {...panelProps('account')}>
            <AccountSection settings={settings} onChange={setSettings} />
            <section aria-labelledby="storage-title">
              <h2 id="storage-title">사진 저장 공간</h2>
              <StorageUsageBar />
            </section>
          </div>
          <div {...panelProps('display')}>
            {/* 016: 화면 테마(이 기기에만 저장, 2026-10-10 머리말 버튼에서 옮김) */}
            <ThemeSettings />
          </div>
          <div {...panelProps('notifications')}>
            <NotificationSettingsSection />
          </div>
          <div {...panelProps('terms')}>
            {/* 013 T037: AI 외부 전송 동의 */}
            <AiConsentSettings />
            <section aria-labelledby="terms-title" className="settings-terms">
              <h2 id="terms-title">이용약관</h2>
              <p className="field-help">이 약관은 초안이에요. 확정되면 이 안내를 지워요.</p>
              <TermsContent headingLevel={3} />
            </section>
          </div>
        </div>
      </div>
    </main>
  );

  function selectTab(value: SettingsTab) {
    setParams(value === 'profile' ? {} : { tab: value }, { replace: true });
  }

  /**
   * 탭 키보드 이동(W3C 탭 패턴): 세로(PC)는 위·아래, 가로(폰)는 왼쪽·오른쪽이 앞뒤 탭이고, Home·End는 처음·끝 탭으로 옮기며
   * 고른다.
   */
  function moveByKey(event: KeyboardEvent<HTMLElement>) {
    const index = AVAILABLE_SETTINGS_TABS.findIndex((t) => t.tab === tab);
    const last = AVAILABLE_SETTINGS_TABS.length - 1;
    const [nextKey, prevKey] = horizontalTabs
      ? ['ArrowRight', 'ArrowLeft']
      : ['ArrowDown', 'ArrowUp'];
    const nextIndex = (
      {
        [nextKey]: index === last ? 0 : index + 1,
        [prevKey]: index === 0 ? last : index - 1,
        Home: 0,
        End: last,
      } as Record<string, number>
    )[event.key];
    if (nextIndex === undefined) return;
    event.preventDefault();
    const next = AVAILABLE_SETTINGS_TABS[nextIndex].tab;
    selectTab(next);
    document.getElementById(`settings-tab-${next}`)?.focus();
  }

  function panelProps(value: SettingsTab) {
    return {
      id: `settings-panel-${value}`,
      role: 'tabpanel',
      'aria-labelledby': `settings-tab-${value}`,
      className: 'settings-panel',
      hidden: value !== tab,
    };
  }
}
