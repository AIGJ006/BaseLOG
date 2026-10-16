import { useEffect, useState } from 'react';
import { getMemberNest, type NestLook } from '../../api/nest';
import NestScene from './NestScene';

/**
 * 둥지 프로필 오른쪽 새 액자 (021, 2026-10-16 민서). 주인이 설정 > 프로필에서 "내 둥지에 새 보이기"를 켰을 때만 보인다 — 기본은
 * 꺼짐. 배경·둥지·새·장식을 그대로 5:4로 그린다. 못 불러오면 조용히 숨긴다.
 */
export default function BlogNestFrame({ handle, nickname }: { handle: string; nickname: string }) {
  const [look, setLook] = useState<NestLook | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMemberNest(handle)
      .then((found) => {
        if (!cancelled) {
          setLook(found);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLook(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (!look?.showOnBlog) {
    return null;
  }
  return (
    <aside className="blog-header__bird" aria-label={`${nickname} 님의 새`} data-testid="blog-bird">
      <NestScene look={look} width={200} />
    </aside>
  );
}
