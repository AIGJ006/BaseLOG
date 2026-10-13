import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { attendNest, getMemberNest, type NestLook } from '../../api/nest';
import type { ToastMessage } from '../../components/Toast';
import NestScene from './NestScene';
import { attendanceToast, NEST_PAGE_PATH, NEST_PAGE_TITLE } from './nestMessages';

/**
 * 둥지 화면 오른쪽 칸 (021 US3): 그 둥지 주인의 꾸민 둥지와 새. 방문자도 본다. 내 둥지면 하루 첫 방문에 출석을 기록하고
 * "출석했어요" 알림을 띄우며, 새 키우기 화면 링크를 둔다. 못 불러오면 칸 없이 둥지 화면은 그대로 보인다(원칙 V).
 */
export interface NestPanelProps {
  handle: string;
  isMe: boolean;
  onToast?: (message: ToastMessage) => void;
}

export default function NestPanel({ handle, isMe, onToast }: NestPanelProps) {
  const [loaded, setLoaded] = useState<{ handle: string; look: NestLook } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        if (isMe) {
          const result = await attendNest();
          if (!cancelled) {
            setLoaded({ handle, look: result.me.nest });
            const toast = attendanceToast(result);
            if (toast) {
              onToast?.(toast);
            }
          }
          return;
        }
        const look = await getMemberNest(handle);
        if (!cancelled) {
          setLoaded({ handle, look });
        }
      } catch {
        // 둥지를 못 불러와도 둥지 화면은 그대로 (원칙 V)
      }
    })();
    return () => {
      cancelled = true;
    };
    // onToast는 화면마다 한 번 정해지는 값이라 다시 부를 까닭이 아니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle, isMe]);

  if (loaded === null || loaded.handle !== handle) {
    return null;
  }
  const look = loaded.look;
  return (
    <section className="nest-panel" aria-label="둥지의 새" data-testid="nest-panel">
      <NestScene look={look} width={176} />
      <p className="nest-panel__caption">
        <strong>{look.levelName}</strong>
        {look.streakDays > 0 ? ` · 연속 출석 ${look.streakDays}일` : ''}
      </p>
      {isMe ? (
        <Link to={NEST_PAGE_PATH} className="nest-panel__link">
          {NEST_PAGE_TITLE}
        </Link>
      ) : null}
    </section>
  );
}
