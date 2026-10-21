import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { attendNest } from '../../api/nest';
import { useToast } from '../../components/useToast';
import { useSession } from '../auth/useSession';
import { attendanceToast, NEST_PAGE_PATH } from './nestMessages';

/** 한국 시간 오늘 `YYYY-MM-DD` */
function seoulToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

/**
 * 하루 출석 (021 US3). 2026-10-21 민서: 로그인한 상태로 그날 처음 사이트 아무 화면에나 들어오면 출석한다
 * (전에는 내 둥지·[새 키우기] 화면에서만). 서버는 하루 한 번만 점수를 주므로, 여기서는 회원·날짜(한국 시간)가 바뀔 때만
 * 부른다. 창을 연 채 날짜가 넘어가거나 앞서 실패했으면 다음 화면 이동 때 다시 부른다. [새 키우기] 화면은 스스로 출석하고 알림을 띄우니 건너뛴다.
 * 실패해도 화면은 그대로(원칙 V).
 */
export default function DailyAttendance() {
  const { me } = useSession();
  const { pathname } = useLocation();
  const { show, toast } = useToast();
  const done = useRef<string | null>(null);

  const memberId = me && me.status === 'ACTIVE' && !me.reagreementRequired ? me.memberId : null;
  const key = memberId === null ? null : `${memberId}:${seoulToday()}`;

  useEffect(() => {
    if (key === null || done.current === key) {
      return;
    }
    if (pathname === NEST_PAGE_PATH) {
      // [새 키우기] 화면이 스스로 출석한다. 그쪽이 실패했을 수 있으니 표시는 남기지 않고 다음 화면에서 한 번 더 부른다.
      return;
    }
    done.current = key;
    void attendNest()
      .then((result) => {
        const message = attendanceToast(result);
        if (message) {
          show(message);
        }
      })
      .catch(() => {
        // 출석을 못 해도 화면은 그대로 (원칙 V). 다음 화면에서 다시 부른다.
        if (done.current === key) {
          done.current = null;
        }
      });
  }, [key, pathname, show]);

  return toast;
}
