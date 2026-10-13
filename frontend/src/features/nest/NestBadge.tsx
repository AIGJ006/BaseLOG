import { useEffect, useState } from 'react';
import { getMemberNest, type NestLook } from '../../api/nest';
import BirdIcon from './BirdIcon';

/**
 * 글 상세 작성자 카드의 둥지 새 배지 (021 US3): 이름 옆에 작은 새 아이콘과 크기 이름("꼬마 새"). 못 불러오면 아무것도 보이지 않는다.
 */
export default function NestBadge({ handle }: { handle: string }) {
  const [look, setLook] = useState<NestLook | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMemberNest(handle).then(
      (next) => {
        if (!cancelled) {
          setLook(next);
        }
      },
      () => {
        // 배지는 없어도 된다
      },
    );
    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (look === null) {
    return null;
  }
  return (
    <span className="nest-badge" data-testid="nest-badge" title={`둥지의 새: ${look.levelName}`}>
      <BirdIcon level={look.level} />
      {look.levelName}
    </span>
  );
}
