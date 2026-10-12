import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { redirectFromSearch } from './safeRedirect';
import { useSession } from './useSession';

/**
 * 비로그인 전용 화면(로그인·가입) 가드. 이미 로그인한 사람이 뒤로가기 등으로 다시 오면 화면을 보이지 않고
 * 돌아갈 곳(`?returnTo=`·`?redirect=`, 없으면 홈)으로 `replace` 이동한다.
 *
 * 브라우저가 뒤로가기 때 예전 화면을 그대로 되살리면(bfcache) 로그인 전 상태가 남아 있으므로 새로 불러 로그인 상태를 다시 읽는다.
 */
export function GuestOnlyGate({ children }: { children: ReactNode }) {
  const { loading, me } = useSession();
  const location = useLocation();

  useEffect(() => {
    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  if (loading) {
    return null;
  }
  if (me) {
    return <Navigate to={redirectFromSearch(location.search)} replace />;
  }
  return <>{children}</>;
}
