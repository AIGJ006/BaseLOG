import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
 * 세지 않는다). 화면을 옮길 때마다 다시 확인하므로 자정을 넘겨 계속 쓰는 방문과 앞서 실패한 요청도 다음 화면에서 보낸다.
 * 화면에는 아무것도 그리지 않는다.
 */
export default function SiteVisitBeacon() {
  const { loading, me } = useSession();
  const who = me ? `m${me.memberId}` : 'guest';
  const isAdmin = me?.role === 'ADMIN';
  const { pathname } = useLocation();
  const today = seoulToday();
  const sending = useRef<string | null>(null);

  useEffect(() => {
    if (loading || isAdmin) return;
    const mark = `${today}:${who}`;
    if (readStorage() === mark || sending.current === mark) return;
    sending.current = mark;
    void recordSiteVisit()
      .then((ok) => {
        if (ok) writeStorage(mark);
      })
      .finally(() => {
        if (sending.current === mark) sending.current = null;
      });
  }, [loading, isAdmin, who, today, pathname]);

  return null;
}
