import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  updateMySettings,
  type MySettings,
  type Provider,
  type SettingsUpdate,
} from '../../api/me';
import PasswordChangeForm from './PasswordChangeForm';
import { formatDate } from '../time/dateFormat';

import { FAILED_MESSAGE } from './settingsShared';

const PROVIDER_LABEL: Record<Provider, string> = {
  LOCAL: '이메일',
  GOOGLE: 'Google',
  GITHUB: 'GitHub',
};

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

/** 설정 › 계정 칸. `SettingsPage`에서 나눴다(2026-11-25). */
export default function AccountSection({
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
