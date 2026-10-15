import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { ApiError, type FieldError } from '../api/client';
import {
  getMyProfile,
  getMySettings,
  updateMyProfile,
  updateMySettings,
  type MyProfile,
  type MySettings,
  type ProfileUpdate,
  type Provider,
  type SettingsUpdate,
} from '../api/me';
import AvailabilityHint from '../components/AvailabilityHint';
import TabIcon from '../components/TabIcon';
import TermsContent from '../components/TermsContent';
import DefaultAvatar from '../components/DefaultAvatar';
import { FRIEND_REQUESTS_PATH } from '../features/friends/friendMessages';
import ProfileImageCropper from '../components/ProfileImageCropper';
import { BANNER_OUTPUT, PROFILE_IMAGE_TYPES } from '../features/profile/profileImageCrop';
import { groupFieldErrors } from '../features/auth/fieldErrors';
import NotificationSettingsSection from '../features/notification/NotificationSettingsSection';
import AiConsentSettings from '../features/ai-suggest/AiConsentSettings';
import ThemeSettings from '../features/theme/ThemeSettings';
import { DARK_MODE_ENABLED } from '../config';
import { useSession } from '../features/auth/useSession';
import { uploadBannerImage, uploadProfileImage } from '../features/profile/uploadProfileImage';
import PasswordChangeForm from '../features/settings/PasswordChangeForm';
import { formatDate } from '../features/time/dateFormat';
import StorageUsageBar from '../components/StorageUsageBar';
import '../features/auth/auth.css';
import '../features/settings/settings.css';
import '../features/profile/banner.css';

/** 닉네임 조건 안내 (09 §2, 서버 판정 규칙과 같음) */
const NICKNAME_RULE =
  '한글·영문·숫자로 2~10자, 한글이나 영문을 1자 이상 넣어 주세요 (공백·특수문자 불가). 바꾸면 30일 동안 다시 바꿀 수 없어요';

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

const BIO_MAX = 200;
const PROVIDER_LABEL: Record<Provider, string> = {
  LOCAL: '이메일',
  GOOGLE: 'Google',
  GITHUB: 'GitHub',
};
const FAILED_MESSAGE = '잠시 후 다시 시도해 주세요';

const HOUR_MINUTE = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 직전 로그인 `YYYY.MM.DD HH:mm` (Asia/Seoul, FR-058). */
function formatLoginTime(value: string): string {
  return `${formatDate(value)} ${HOUR_MINUTE.format(new Date(value))}`;
}

type PendingPhoto =
  { kind: 'none' } | { kind: 'default' } | { kind: 'cropped'; blob: Blob; url: string };

/**
 * 설정 화면 `/settings` (001 T122, FR-046~053·045, 11 §5·§6). 비로그인은 `/login?returnTo=%2Fsettings`로.
 *
 * - 프로필: 사진([사진 바꾸기]·[기본 이미지로] — 고른 사진은 [저장] 때 올리고 연결한다), 닉네임(30일 제한 중이면 막고 다음 변경
 *   가능일), 소개(글자 수는 코드 포인트), 블로그 주소 `@handle` 읽기 전용. [저장] 한 번에 바꾼 칸만 보내고, 실패한 칸을 모두 보인다.
 *   025 배너: [사진 고르기] → 4:1로 보일 영역 고르기(1500×375로 다시 그림), [배너 지우기]는 기본 배경으로. 프로필 사진처럼 [저장] 때
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
          aria-orientation="vertical"
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

  /** 세로 탭 키보드 이동(W3C 탭 패턴): 위·아래는 앞뒤 탭, Home·End는 처음·끝 탭으로 옮기며 고른다. */
  function moveByKey(event: KeyboardEvent<HTMLElement>) {
    const index = AVAILABLE_SETTINGS_TABS.findIndex((t) => t.tab === tab);
    const last = AVAILABLE_SETTINGS_TABS.length - 1;
    const nextIndex = (
      {
        ArrowDown: index === last ? 0 : index + 1,
        ArrowUp: index === 0 ? last : index - 1,
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

type ProfileDraft = {
  nickname: string;
  nicknameLocked: boolean;
  bio: string;
  photo: PendingPhoto;
  banner: PendingPhoto;
};

/** 프로필 칸에서 바뀐 것만 담는다(사진·배너 새로 올리기는 저장 때 따로). */
function profileChanges(profile: MyProfile, draft: ProfileDraft): ProfileUpdate {
  const update: ProfileUpdate = {};
  if (!draft.nicknameLocked && draft.nickname !== profile.nickname) {
    update.nickname = draft.nickname;
  }
  if (draft.bio !== (profile.bio ?? '')) {
    update.bio = draft.bio === '' ? null : draft.bio;
  }
  if (draft.photo.kind === 'default') {
    update.profileImageId = null;
  }
  if (draft.banner.kind === 'default') {
    update.bannerImageId = null;
  }
  return update;
}

/** 자른 사진·배너를 올리고 번호를 update에 넣는다. 실패하면 안내 문구를 돌려준다. */
async function uploadPendingImages(
  update: ProfileUpdate,
  photo: PendingPhoto,
  banner: PendingPhoto,
): Promise<string | null> {
  if (photo.kind === 'cropped') {
    try {
      update.profileImageId = await uploadProfileImage(photo.blob);
    } catch {
      return '사진을 올리지 못했어요. 다시 시도해 주세요';
    }
  }
  if (banner.kind === 'cropped') {
    try {
      update.bannerImageId = await uploadBannerImage(banner.blob);
    } catch {
      return '배너를 올리지 못했어요. 다시 시도해 주세요';
    }
  }
  return null;
}

/** 프로필 저장 실패를 칸 오류 또는 안내 문구로 바꾼다. */
function profileSaveFailure(caught: unknown):
  | { fieldErrors: Record<string, FieldError[]>; message?: undefined }
  | {
      fieldErrors?: undefined;
      message: string;
    } {
  if (caught instanceof ApiError && caught.code === 'NICKNAME_CHANGE_TOO_SOON') {
    return {
      fieldErrors: {
        nickname: [{ field: 'nickname', code: caught.code, message: caught.message }],
      },
    };
  }
  if (caught instanceof ApiError && caught.errors.length > 0) {
    return { fieldErrors: groupFieldErrors(caught.errors) };
  }
  return { message: caught instanceof ApiError ? caught.message : FAILED_MESSAGE };
}

function PhotoPreview({
  photo,
  profile,
  nickname,
}: Readonly<{ photo: PendingPhoto; profile: MyProfile; nickname: string }>) {
  if (photo.kind === 'cropped') {
    return <img src={photo.url} alt="새 프로필 사진 미리보기" />;
  }
  if (photo.kind === 'default' || !profile.profileImageUrl) {
    return <DefaultAvatar nickname={nickname} handle={profile.handle} size={64} />;
  }
  return <img src={profile.profileImageUrl} alt="프로필 사진" />;
}

function bannerPreview(banner: PendingPhoto, savedUrl: string | null) {
  if (banner.kind === 'cropped') {
    return <img src={banner.url} alt="새 배너 미리보기" />;
  }
  if (banner.kind === 'default' || !savedUrl) {
    return null;
  }
  return <img src={savedUrl} alt="배너" />;
}

function ProfileSection({
  profile,
  onSaved,
}: {
  profile: MyProfile;
  onSaved: (profile: MyProfile) => void;
}) {
  const [nickname, setNickname] = useState(profile.nickname);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [photo, setPhoto] = useState<PendingPhoto>({ kind: 'none' });
  // 고른 사진 파일. 있으면 자르기 화면을 연다([사진 바꾸기]는 바로 파일 고르기 창을 띄움)
  const [cropFile, setCropFile] = useState<File | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // 025 둥지 배너: 프로필 사진과 같은 흐름(고르기 → 자르기 → [저장] 때 올리기)
  const [banner, setBanner] = useState<PendingPhoto>({ kind: 'none' });
  const [bannerCropFile, setBannerCropFile] = useState<File | null>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  function onBannerPicked(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (picked) {
      setBannerCropFile(picked);
    }
  }

  function onPhotoPicked(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (picked) {
      setCropFile(picked);
    }
  }
  const [fieldErrors, setFieldErrors] = useState<Record<string, FieldError[]>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(
    () => () => {
      if (photo.kind === 'cropped') {
        URL.revokeObjectURL(photo.url);
      }
    },
    [photo],
  );

  useEffect(
    () => () => {
      if (banner.kind === 'cropped') {
        URL.revokeObjectURL(banner.url);
      }
    },
    [banner],
  );

  const nicknameLocked = profile.nicknameChangeAvailableAt !== null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const update = profileChanges(profile, { nickname, nicknameLocked, bio, photo, banner });
    if (Object.keys(update).length === 0 && photo.kind !== 'cropped' && banner.kind !== 'cropped') {
      setMessage({ kind: 'error', text: '바꾼 내용이 없어요' });
      return;
    }
    setSaving(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const uploadFailure = await uploadPendingImages(update, photo, banner);
      if (uploadFailure) {
        setMessage({ kind: 'error', text: uploadFailure });
        return;
      }
      const saved = await updateMyProfile(update);
      setPhoto({ kind: 'none' });
      setBanner({ kind: 'none' });
      setNickname(saved.nickname);
      setBio(saved.bio ?? '');
      setMessage({ kind: 'ok', text: '저장했어요' });
      onSaved(saved);
    } catch (caught) {
      const failure = profileSaveFailure(caught);
      if (failure.fieldErrors) {
        setFieldErrors(failure.fieldErrors);
      } else {
        setMessage({ kind: 'error', text: failure.message });
      }
    } finally {
      setSaving(false);
    }
  }

  function errorsOf(field: string) {
    const list = fieldErrors[field] ?? [];
    return list.length === 0 ? null : (
      <div className="field-error" id={`profile-${field}-error`}>
        {list.map((e) => (
          <p key={e.code}>{e.message}</p>
        ))}
      </div>
    );
  }

  const bioLength = [...bio].length;
  const currentPhoto = (
    <PhotoPreview photo={photo} profile={profile} nickname={nickname || profile.nickname} />
  );
  const currentBanner = bannerPreview(banner, profile.bannerImageUrl);

  return (
    <section aria-labelledby="profile-title">
      <h2 id="profile-title">프로필</h2>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <div className="profile-photo">
          {currentPhoto}
          <div className="settings-actions">
            <button
              type="button"
              className="link-button"
              onClick={() => photoInputRef.current?.click()}
            >
              사진 바꾸기
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept={PROFILE_IMAGE_TYPES.join(',')}
              onChange={onPhotoPicked}
              className="visually-hidden"
              tabIndex={-1}
              aria-label="프로필 사진 파일"
            />
            {(profile.profileImageUrl || photo.kind === 'cropped') && photo.kind !== 'default' && (
              <button
                type="button"
                className="link-button"
                onClick={() => setPhoto({ kind: 'default' })}
              >
                기본 이미지로
              </button>
            )}
          </div>
        </div>
        {cropFile && (
          <ProfileImageCropper
            key={`${cropFile.name}-${cropFile.lastModified}-${cropFile.size}`}
            file={cropFile}
            onCropped={(blob) => {
              setPhoto({ kind: 'cropped', blob, url: URL.createObjectURL(blob) });
              setCropFile(null);
            }}
            onCancel={() => setCropFile(null)}
          />
        )}
        {errorsOf('profileImageId')}

        <div className="field profile-banner">
          <span id="profile-banner-label">배너</span>
          <div
            className="blog-banner blog-banner--preview"
            data-testid="profile-banner-preview"
            data-empty={currentBanner === null ? 'true' : undefined}
          >
            {currentBanner}
          </div>
          <p id="profile-banner-help" className="field-help">
            둥지 맨 위에 넓게 보여요. 고른 사진에서 가로 4:1로 보일 영역을 골라요
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="link-button"
              aria-describedby="profile-banner-help"
              onClick={() => bannerInputRef.current?.click()}
            >
              사진 고르기
            </button>
            <input
              ref={bannerInputRef}
              type="file"
              accept={PROFILE_IMAGE_TYPES.join(',')}
              onChange={onBannerPicked}
              className="visually-hidden"
              tabIndex={-1}
              aria-label="배너 사진 파일"
            />
            {(profile.bannerImageUrl || banner.kind === 'cropped') && banner.kind !== 'default' && (
              <button
                type="button"
                className="link-button"
                onClick={() => setBanner({ kind: 'default' })}
              >
                배너 지우기
              </button>
            )}
          </div>
        </div>
        {bannerCropFile && (
          <ProfileImageCropper
            key={`banner-${bannerCropFile.name}-${bannerCropFile.lastModified}-${bannerCropFile.size}`}
            file={bannerCropFile}
            output={BANNER_OUTPUT}
            onCropped={(blob) => {
              setBanner({ kind: 'cropped', blob, url: URL.createObjectURL(blob) });
              setBannerCropFile(null);
            }}
            onCancel={() => setBannerCropFile(null)}
          />
        )}
        {errorsOf('bannerImageId')}

        <div className="field">
          <label htmlFor="profile-nickname">닉네임</label>
          <input
            id="profile-nickname"
            value={nickname}
            disabled={nicknameLocked}
            maxLength={20}
            onChange={(e) => setNickname(e.target.value)}
            aria-invalid={fieldErrors.nickname ? true : undefined}
            aria-describedby={[
              'profile-nickname-help',
              fieldErrors.nickname ? 'profile-nickname-error' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          />
          {nicknameLocked && profile.nicknameChangeAvailableAt ? (
            <p id="profile-nickname-help" className="field-help">
              닉네임은 바꾼 뒤 30일이 지나야 다시 바꿀 수 있어요. 다음 변경 가능일{' '}
              {formatDate(profile.nicknameChangeAvailableAt)}
            </p>
          ) : (
            <>
              <p id="profile-nickname-help" className="field-help">
                {NICKNAME_RULE}
              </p>
              <AvailabilityHint kind="nickname" value={nickname} current={profile.nickname} />
            </>
          )}
          {errorsOf('nickname')}
        </div>

        <div className="field">
          <label htmlFor="profile-bio">소개</label>
          <textarea
            id="profile-bio"
            rows={4}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            aria-invalid={fieldErrors.bio ? true : undefined}
            aria-describedby={fieldErrors.bio ? 'profile-bio-error' : undefined}
          />
          <span className="counter" aria-live="polite">
            {bioLength}/{BIO_MAX}
          </span>
          {errorsOf('bio')}
        </div>

        <div className="field">
          <span>둥지 주소</span>
          <span>@{profile.handle}</span>
        </div>

        {message && (
          <p
            role={message.kind === 'error' ? 'alert' : 'status'}
            className={message.kind === 'error' ? 'form-error' : 'status-ok'}
          >
            {message.text}
          </p>
        )}
        <button type="submit" className="primary" disabled={saving}>
          저장
        </button>
      </form>
    </section>
  );
}

function AccountSection({
  settings,
  onChange,
}: {
  settings: MySettings;
  onChange: (settings: MySettings) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  async function save(update: SettingsUpdate): Promise<MySettings | null> {
    setError(null);
    try {
      const saved = await updateMySettings(update);
      onChange(saved);
      return saved;
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : FAILED_MESSAGE);
      return null;
    }
  }

  return (
    <section aria-labelledby="account-title">
      <h2 id="account-title">계정</h2>
      <dl className="settings-dl">
        <dt>이메일</dt>
        <dd>{settings.email ?? '없음'}</dd>
        <dt>로그인 수단</dt>
        <dd>{PROVIDER_LABEL[settings.provider]}</dd>
        <dt>직전 로그인</dt>
        <dd>
          {settings.previousLogin
            ? `${formatLoginTime(settings.previousLogin.at)}, ${PROVIDER_LABEL[settings.previousLogin.provider] ?? settings.previousLogin.provider}`
            : '첫 로그인'}
        </dd>
      </dl>
      <div className="check">
        <input
          id="settings-last-active"
          type="checkbox"
          checked={settings.lastActiveVisible}
          aria-describedby="settings-last-active-help"
          onChange={(e) => void save({ lastActiveVisible: e.target.checked })}
        />
        <label htmlFor="settings-last-active">최근 활동을 친구에게 보이기</label>
        <p className="field-help" id="settings-last-active-help">
          친구에게 "오늘·어제·N일 전·1주 이상"으로만 보여요. 끄면 나도 친구의 최근 활동을 볼 수
          없어요.
        </p>
      </div>
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <PasswordChangeForm available={settings.passwordChangeAvailable} />
      <p>
        <Link to="/terms">이용약관</Link> · <Link to="/privacy">개인정보 처리방침</Link>
      </p>
      {/* 015 회원 탈퇴 (001 T122 자리) */}
      <p>
        <Link to="/settings/withdraw">회원 탈퇴</Link>
      </p>
    </section>
  );
}
