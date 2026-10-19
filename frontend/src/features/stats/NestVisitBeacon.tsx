import { useEffect, useRef } from 'react';
import { recordNestVisit } from '../../api/stats';
import { useSession } from '../auth/useSession';

const STORAGE_KEY = 'baselog.nestVisits';

/** 한국 시간 오늘 `YYYY-MM-DD` */
function seoulToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/** `{ 둥지 주소: "날짜:누구" }` — 오늘 표시만 남겨 둥지를 많이 돌아다녀도 커지지 않게 한다 */
function readMarks(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeMark(handle: string, mark: string, today: string): void {
  try {
    const kept = Object.fromEntries(
      Object.entries(readMarks()).filter(([, value]) => value.startsWith(`${today}:`)),
    );
    kept[handle] = mark;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(kept));
  } catch {
    // 저장소를 못 쓰면 다음에 또 보낸다 — 서버가 같은 방문자를 한 번만 센다
  }
}

/**
 * 031 둥지 방문 기록. 둥지(`/@주소`)를 열면 둥지마다 하루 한 번(같은 브라우저·같은 회원) `POST /api/members/{handle}/visits`를
 * 보낸다. 내 둥지와 관리자는 보내지 않는다(서버도 세지 않는다). 화면에는 아무것도 그리지 않는다.
 */
export default function NestVisitBeacon({
  handle,
  isMe,
}: Readonly<{ handle: string; isMe: boolean }>) {
  const { loading, me } = useSession();
  const who = me ? `m${me.memberId}` : 'guest';
  const isAdmin = me?.role === 'ADMIN';
  const today = seoulToday();
  const sending = useRef<string | null>(null);

  useEffect(() => {
    if (loading || isAdmin || isMe || !handle) return;
    const mark = `${today}:${who}`;
    const key = `${handle}|${mark}`;
    if (readMarks()[handle] === mark || sending.current === key) return;
    sending.current = key;
    void recordNestVisit(handle)
      .then((ok) => {
        if (ok) writeMark(handle, mark, today);
      })
      .finally(() => {
        if (sending.current === key) sending.current = null;
      });
  }, [loading, isAdmin, isMe, handle, who, today]);

  return null;
}
