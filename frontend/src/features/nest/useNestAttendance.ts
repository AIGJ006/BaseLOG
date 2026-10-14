import { useEffect } from 'react';
import { attendNest } from '../../api/nest';
import type { ToastMessage } from '../../components/Toast';
import { attendanceToast } from './nestMessages';

/**
 * 내 둥지 출석 (021 US3): 내 둥지 화면에 하루 처음 들어오면 출석을 기록하고 "출석했어요" 알림을 띄운다.
 * 둥지 머리말의 새 칸은 뺐다(민서 "걍빼자", 2026-10-14) — 새는 [새 키우기] 화면에서 본다. 실패해도 둥지 화면은 그대로(원칙 V).
 */
export function useNestAttendance(isMe: boolean, onToast?: (message: ToastMessage) => void) {
  useEffect(() => {
    if (!isMe) {
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        const toast = attendanceToast(await attendNest());
        if (!cancelled && toast) {
          onToast?.(toast);
        }
      } catch {
        // 출석을 못 해도 둥지 화면은 그대로 (원칙 V)
      }
    })();
    return () => {
      cancelled = true;
    };
    // onToast는 화면마다 한 번 정해지는 값이라 다시 부를 까닭이 아니다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMe]);
}
