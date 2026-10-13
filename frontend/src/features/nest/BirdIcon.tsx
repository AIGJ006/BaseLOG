import './nest.css';

/**
 * 작은 새 아이콘 (021, 글 상세 작성자 카드). 둥지 그림의 참새와 같은 모양을 머리·몸만 그린다. 단계가 클수록 조금 크다(18~26px).
 * 장식이라 화면 읽기는 옆 글자("꼬마 새")가 맡는다.
 */
export default function BirdIcon({ level }: { level: number }) {
  const step = Math.min(5, Math.max(1, Math.round(level)));
  const size = 16 + step * 2;
  return (
    <svg
      className="bird-icon"
      viewBox="-62 -94 120 96"
      width={size}
      height={(size * 96) / 120}
      aria-hidden="true"
      data-testid="bird-icon"
    >
      <path d="M-30 -42 L-60 -60 L-52 -30 z" fill="var(--bird-head)" />
      <ellipse cx="0" cy="-34" rx="38" ry="30" fill="var(--bird-body)" />
      <ellipse cx="10" cy="-26" rx="22" ry="20" fill="var(--bird-belly)" />
      <circle cx="20" cy="-68" r="22" fill="var(--bird-head)" />
      <circle cx="27" cy="-72" r="3.4" fill="var(--bird-eye)" />
      <path d="M40 -70 L54 -64 L40 -59 z" fill="var(--bird-beak)" />
    </svg>
  );
}
