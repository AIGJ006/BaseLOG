import { useEffect, useState } from 'react';

/** settings.css의 폰 너비(탭을 위쪽 가로 한 줄로 놓는 곳)와 같은 조건 */
const QUERY = '(max-width: 640px)';

function matches(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}

/** 설정 탭이 가로 한 줄로 놓이는 폰 너비이면 true. 탭 목록의 aria-orientation과 방향키를 화면 모양에 맞춘다. */
export function useHorizontalTabs(): boolean {
  const [horizontal, setHorizontal] = useState(matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia(QUERY);
    const onChange = () => setHorizontal(media.matches);
    onChange();
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  return horizontal;
}
