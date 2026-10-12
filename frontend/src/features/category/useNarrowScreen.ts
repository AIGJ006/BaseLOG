import { useEffect, useState } from 'react';

const QUERY = '(max-width: 767px) and (pointer: coarse)';

function matches(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false;
}

/** 휴대폰·태블릿(pointer: coarse)에서 768px 미만이면 true (PC는 창을 줄여도 펼친 채) — 블로그 카테고리 목록을 접는다 (017 FR-033). */
export function useNarrowScreen(): boolean {
  const [narrow, setNarrow] = useState(matches);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return undefined;
    }
    const media = window.matchMedia(QUERY);
    const onChange = () => setNarrow(media.matches);
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, []);
  return narrow;
}
