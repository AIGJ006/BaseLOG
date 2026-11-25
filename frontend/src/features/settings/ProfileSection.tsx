import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, type FieldError } from '../../api/client';
import { updateMyProfile, type MyProfile, type ProfileUpdate } from '../../api/me';
import AvailabilityHint from '../../components/AvailabilityHint';
import DefaultAvatar from '../../components/DefaultAvatar';
import ProfileImageCropper from '../../components/ProfileImageCropper';
import { BANNER_OUTPUT, PROFILE_IMAGE_TYPES } from '../profile/profileImageCrop';
import BannerColorPicker from '../profile/BannerColorPicker';
import { bannerColorStyle } from '../profile/bannerColor';
import { groupFieldErrors } from '../auth/fieldErrors';
import { uploadBannerImage, uploadProfileImage } from '../profile/uploadProfileImage';
import { formatDate } from '../time/dateFormat';

import { FAILED_MESSAGE } from './settingsShared';

/** 닉네임 조건 안내 (09 §2, 서버 판정 규칙과 같음) */
const NICKNAME_RULE =
  '한글·영문·숫자로 2~10자, 한글이나 영문을 1자 이상 넣어 주세요 (공백·특수문자 불가). 바꾸면 30일 동안 다시 바꿀 수 없어요';
const BIO_MAX = 200;

export type PendingPhoto =
  { kind: 'none' } | { kind: 'default' } | { kind: 'cropped'; blob: Blob; url: string };

type ProfileDraft = {
  nickname: string;
  nicknameLocked: boolean;
  bio: string;
  photo: PendingPhoto;
  banner: PendingPhoto;
  bannerColor: string | null;
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
  if (draft.bannerColor !== profile.bannerColor) {
    update.bannerColor = draft.bannerColor;
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
type ProfileSaveFailure =
  | { kind: 'fields'; fieldErrors: Record<string, FieldError[]> }
  | { kind: 'message'; message: string };

function profileSaveFailure(caught: unknown): ProfileSaveFailure {
  if (caught instanceof ApiError && caught.code === 'NICKNAME_CHANGE_TOO_SOON') {
    return {
      kind: 'fields',
      fieldErrors: {
        nickname: [{ field: 'nickname', code: caught.code, message: caught.message }],
      },
    };
  }
  if (caught instanceof ApiError && caught.errors.length > 0) {
    return { kind: 'fields', fieldErrors: groupFieldErrors(caught.errors) };
  }
  return {
    kind: 'message',
    message: caught instanceof ApiError ? caught.message : FAILED_MESSAGE,
  };
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

/** 설정 › 프로필 칸 (사진·배너·닉네임·소개). `SettingsPage`에서 나눴다(2026-11-25). */
export default function ProfileSection({
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
  const [bannerColor, setBannerColor] = useState<string | null>(profile.bannerColor);
  const [bannerColorInvalid, setBannerColorInvalid] = useState(false);

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
    if (bannerColorInvalid) {
      setMessage({ kind: 'error', text: '배너 색 코드를 고쳐 주세요' });
      return;
    }
    const update = profileChanges(profile, {
      nickname,
      nicknameLocked,
      bio,
      photo,
      banner,
      bannerColor,
    });
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
      setBannerColor(saved.bannerColor);
      setMessage({ kind: 'ok', text: '저장했어요' });
      onSaved(saved);
    } catch (caught) {
      const failure = profileSaveFailure(caught);
      if (failure.kind === 'fields') {
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
            data-color={currentBanner === null && bannerColor ? 'true' : undefined}
            style={currentBanner === null ? bannerColorStyle(bannerColor) : undefined}
          >
            {currentBanner}
          </div>
          <p id="profile-banner-help" className="field-help">
            둥지 맨 위에 넓게 보여요. 고른 사진에서 가로 5:2로 보일 영역을 골라요
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="link-button"
              aria-label="배너 사진 바꾸기"
              aria-describedby="profile-banner-help"
              onClick={() => bannerInputRef.current?.click()}
            >
              사진 바꾸기
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
        <BannerColorPicker
          value={bannerColor}
          onChange={(color) => {
            setBannerColor(color);
            setBannerColorInvalid(false);
          }}
          onInvalidChange={setBannerColorInvalid}
        />
        {errorsOf('bannerColor')}

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
