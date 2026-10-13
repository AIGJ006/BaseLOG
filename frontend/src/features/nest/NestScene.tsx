import { useId } from 'react';
import type { NestLook } from '../../api/nest';
import { describeNest } from './nestItems';
import './nest.css';

/**
 * 둥지 그림 (021). 로고의 둥지 B처럼 갈색 가지로 엮은 둥지에 새가 앉아 있다. 새 크기는 단계(1~5)에 따라 60%~100%.
 * 배경·장식·테두리는 장착한 물건 코드대로 그린다. 색은 모두 `tokens.css`의 둥지 토큰(라이트·다크 쌍)만 쓴다.
 */
export interface NestSceneProps {
  look: Pick<NestLook, 'level' | 'levelName' | 'background' | 'border' | 'decorations'>;
  /** 그림 너비(px 숫자 또는 CSS 값). 높이는 0.8배 */
  width?: number | string;
  className?: string;
}

const BACKGROUNDS = new Set([
  'bg-basic',
  'bg-meadow',
  'bg-sky',
  'bg-sunset',
  'bg-cherry',
  'bg-night',
]);
const BORDERS = new Set(['border-none', 'border-twig', 'border-gold']);

export default function NestScene({ look, width = 200, className }: NestSceneProps) {
  const background = BACKGROUNDS.has(look.background) ? look.background : 'bg-basic';
  const border = BORDERS.has(look.border) ? look.border : 'border-none';
  const decorations = new Set(look.decorations);
  const id = useId().replace(/:/g, '');
  return (
    <figure
      className={['nest-scene', `nest-scene--${border}`, className].filter(Boolean).join(' ')}
      style={{ width }}
      data-testid="nest-scene"
      data-level={look.level}
    >
      <svg viewBox="0 0 200 160" role="img" aria-label={describeNest(look)}>
        <defs>
          <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: 'var(--color-surface)', stopOpacity: 0.4 }} />
            <stop offset="0.7" style={{ stopColor: 'var(--color-surface)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="200" height="160" fill={`var(--nest-${background})`} />
        <rect x="0" y="0" width="200" height="160" fill={`url(#${id}-light)`} />
        <Backdrop background={background} />
        {decorations.has('deco-star') ? <Star x={168} y={30} r={11} /> : null}
        {decorations.has('deco-flower') ? <Flower x={32} y={44} /> : null}
        <NestBack />
        <Bird level={look.level} />
        <NestFront clipId={`${id}-bowl`} />
        {decorations.has('deco-egg') ? <Egg x={150} y={116} /> : null}
        {decorations.has('deco-leaf') ? <Leaf x={44} y={116} /> : null}
        {decorations.has('deco-feather') ? <Feather x={168} y={96} /> : null}
      </svg>
    </figure>
  );
}

/** 배경마다 작은 무늬: 풀밭은 언덕, 밤하늘은 별과 달, 벚꽃은 꽃잎, 노을은 해, 하늘은 구름 */
function Backdrop({ background }: { background: string }) {
  switch (background) {
    case 'bg-meadow':
      return (
        <g fill="var(--nest-ground)">
          <ellipse cx="40" cy="176" rx="90" ry="44" />
          <ellipse cx="170" cy="182" rx="90" ry="46" />
        </g>
      );
    case 'bg-night':
      return (
        <g fill="var(--deco-star)">
          <circle cx="24" cy="22" r="1.4" />
          <circle cx="62" cy="38" r="1" />
          <circle cx="150" cy="70" r="1.2" />
          <circle cx="186" cy="64" r="1" />
          <circle cx="36" cy="70" r="0.9" />
          <circle cx="92" cy="46" r="0.8" />
          <path d="M70 12 a12 12 0 1 0 10 19 a9 9 0 1 1 -10 -19z" opacity="0.9" />
        </g>
      );
    case 'bg-cherry':
      return (
        <g fill="var(--deco-flower)" opacity="0.5">
          <path d="M28 22 q5 -6 9 0 q-4 6 -9 0z" />
          <path d="M80 12 q5 -6 9 0 q-4 6 -9 0z" transform="rotate(25 84 12)" />
          <path d="M130 30 q5 -6 9 0 q-4 6 -9 0z" transform="rotate(-30 134 30)" />
          <path d="M178 16 q5 -6 9 0 q-4 6 -9 0z" />
          <path d="M14 84 q5 -6 9 0 q-4 6 -9 0z" transform="rotate(40 18 84)" />
          <path d="M184 92 q5 -6 9 0 q-4 6 -9 0z" transform="rotate(-20 188 92)" />
        </g>
      );
    case 'bg-sunset':
      return <circle cx="160" cy="40" r="18" fill="var(--bird-beak)" opacity="0.45" />;
    case 'bg-sky':
      return (
        <g fill="var(--color-surface)" opacity="0.85">
          <path d="M24 38 a10 10 0 0 1 18 -6 a12 12 0 0 1 22 4 a8 8 0 0 1 0 14 h-40 a6 6 0 0 1 0 -12z" />
          <path d="M136 58 a8 8 0 0 1 14 -4 a10 10 0 0 1 18 3 a6 6 0 0 1 0 11 h-32 a5 5 0 0 1 0 -10z" />
        </g>
      );
    default:
      return (
        <g fill="var(--deco-leaf)" opacity="0.18">
          <path d="M18 160 q6 -30 14 -34 q-2 18 -6 34z" />
          <path d="M30 160 q2 -22 12 -26 q-4 14 -6 26z" />
          <path d="M170 160 q4 -26 14 -30 q-4 16 -8 30z" />
        </g>
      );
  }
}

/** 둥지 안쪽(새 뒤에 그림) */
function NestBack() {
  return <ellipse cx="100" cy="110" rx="60" ry="12" fill="var(--nest-twig-dark)" />;
}

/** 엮은 가지 결 — 그릇 안에서만 보이게 자른다 */
const WEAVE = Array.from({ length: 9 }, (_, i) => {
  const y = 112 + i * 4.4;
  const sag = i % 2 === 0 ? 10 : 4;
  return `M30 ${y} Q100 ${y + sag} 170 ${y - 2}`;
});
const CROSS = [
  'M52 110 Q66 132 92 150',
  'M78 112 Q92 132 120 150',
  'M148 110 Q134 132 106 150',
  'M122 112 Q108 134 80 150',
  'M164 112 Q150 132 132 146',
  'M36 112 Q48 130 64 144',
];

/** 둥지 앞쪽(새 아랫부분을 가림): 가지를 엇갈려 엮은 그릇, 테두리는 굵은 가지 한 바퀴 */
function NestFront({ clipId }: { clipId: string }) {
  return (
    <g>
      <defs>
        <clipPath id={clipId}>
          <path d="M34 110 C36 138 68 151 100 151 C132 151 164 138 166 110 Q100 124 34 110z" />
        </clipPath>
      </defs>
      <ellipse cx="100" cy="152" rx="58" ry="6" fill="var(--nest-twig-dark)" opacity="0.18" />
      <path
        d="M34 110 C36 138 68 151 100 151 C132 151 164 138 166 110 Q100 124 34 110z"
        fill="var(--nest-twig)"
      />
      <g clipPath={`url(#${clipId})`} fill="none" strokeLinecap="round">
        {WEAVE.map((d, i) => (
          <path
            key={d}
            d={d}
            stroke={i % 2 === 0 ? 'var(--nest-twig-light)' : 'var(--nest-twig-dark)'}
            strokeWidth={i % 2 === 0 ? 2.2 : 1.4}
          />
        ))}
        {CROSS.map((d, i) => (
          <path
            key={d}
            d={d}
            stroke={i % 2 === 0 ? 'var(--nest-twig-dark)' : 'var(--nest-twig-light)'}
            strokeWidth="1.4"
            opacity="0.85"
          />
        ))}
      </g>
      <g fill="none" strokeLinecap="round">
        <path d="M32 109 Q100 127 168 109" stroke="var(--nest-twig-light)" strokeWidth="6" />
        <path d="M34 107 Q100 122 166 107" stroke="var(--nest-twig)" strokeWidth="2" />
        <path d="M40 112 Q100 128 160 112" stroke="var(--nest-twig-dark)" strokeWidth="1.2" />
        <path
          d="M30 108 L20 101 M35 113 L24 116 M168 108 L180 100 M165 114 L178 118 M88 150 L84 157 M116 150 L121 156"
          stroke="var(--nest-twig)"
          strokeWidth="2"
        />
      </g>
    </g>
  );
}

/** 동글동글한 참새. 단계마다 크기가 62%·71%·80%·90%·100% */
function Bird({ level }: { level: number }) {
  const step = Math.min(5, Math.max(1, Math.round(level)));
  const scale = [0.62, 0.71, 0.8, 0.9, 1][step - 1];
  return (
    <g transform={`translate(100 120) scale(${scale})`} data-testid="nest-bird">
      <path d="M-26 -40 Q-52 -62 -60 -50 Q-50 -36 -30 -26z" fill="var(--bird-head)" />
      <ellipse cx="0" cy="-30" rx="36" ry="31" fill="var(--bird-body)" />
      <ellipse cx="9" cy="-21" rx="23" ry="20" fill="var(--bird-belly)" />
      <path d="M-30 -36 Q-20 -54 2 -46 Q10 -30 -6 -18 Q-26 -16 -30 -36z" fill="var(--bird-head)" />
      <path
        d="M-22 -34 Q-12 -38 -2 -34 M-20 -27 Q-11 -30 -3 -27"
        stroke="var(--bird-belly)"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <circle cx="16" cy="-62" r="25" fill="var(--bird-head)" />
      <ellipse cx="25" cy="-54" rx="13" ry="10" fill="var(--bird-belly)" />
      <circle cx="24" cy="-66" r="4.4" fill="var(--bird-eye)" />
      <circle cx="25.6" cy="-67.6" r="1.5" fill="var(--bird-belly)" />
      <ellipse cx="32" cy="-55" rx="4.5" ry="2.6" fill="var(--deco-flower)" opacity="0.45" />
      <path d="M38 -64 Q48 -62 50 -59 Q46 -56 38 -57z" fill="var(--bird-beak)" />
    </g>
  );
}

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    return `${(x + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return <polygon points={points} fill="var(--deco-star)" data-testid="deco-star" />;
}

function Flower({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="deco-flower">
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse
          key={deg}
          cx={x}
          cy={y - 7}
          rx="4.5"
          ry="7"
          fill="var(--deco-flower)"
          transform={`rotate(${deg} ${x} ${y})`}
        />
      ))}
      <circle cx={x} cy={y} r="4" fill="var(--deco-flower-center)" />
    </g>
  );
}

function Egg({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="deco-egg">
      <ellipse cx={x} cy={y} rx="9" ry="12" fill="var(--deco-egg)" />
      <circle cx={x - 3} cy={y - 3} r="1.6" fill="var(--deco-egg-spot)" />
      <circle cx={x + 3} cy={y + 3} r="1.3" fill="var(--deco-egg-spot)" />
    </g>
  );
}

function Leaf({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="deco-leaf" transform={`rotate(-35 ${x} ${y})`}>
      <path
        d={`M${x - 14} ${y} Q${x} ${y - 10} ${x + 14} ${y} Q${x} ${y + 10} ${x - 14} ${y}z`}
        fill="var(--deco-leaf)"
      />
      <path d={`M${x - 14} ${y} L${x + 12} ${y}`} stroke="var(--nest-twig-dark)" strokeWidth="1" />
    </g>
  );
}

function Feather({ x, y }: { x: number; y: number }) {
  return (
    <g data-testid="deco-feather" transform={`rotate(25 ${x} ${y})`}>
      <ellipse cx={x} cy={y} rx="5" ry="16" fill="var(--deco-feather)" />
      <path d={`M${x} ${y - 16} L${x} ${y + 20}`} stroke="var(--nest-twig-dark)" strokeWidth="1" />
    </g>
  );
}
