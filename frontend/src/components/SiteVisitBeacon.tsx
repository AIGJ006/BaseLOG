import { useEffect } from 'react';
import { recordSiteVisit } from '../api/stats';
import { useSession } from '../features/auth/useSession';

const STORAGE_KEY = 'baselog.visit';

/** 한국 시간 오늘 `YYYY-MM-DD` */
function seoulToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

function readStorage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // 저장소를 못 쓰면 다음에 또 보낸다 — 서버가 같은 방문자를 한 번만 센다
  }
}

/**
 * 024 방문 기록. 로그인 상태를 안 뒤 하루 한 번(같은 브라우저·같은 회원) `POST /api/visits`를 보낸다. 관리자는 보내지 않는다(서버도
 * 세지 않는다). 화면에는 아무것도 그리지 않는다.
 */
export default function SiteVisitBeacon() {
  const { loading, me } = useSession();
  const who = me ? `m${me.memberId}` : 'guest';
  const isAdmin = me?.role === 'ADMIN';

  useEffect(() => {
    if (loading || isAdmin) return;
    const mark = `${seoulToday()}:${who}`;
    if (readStorage() === mark) return;
    void recordSiteVisit().then((ok) => {
      if (ok) writeStorage(mark);
    });
  }, [loading, isAdmin, who]);

  return null;
}
