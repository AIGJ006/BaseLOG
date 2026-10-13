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
  return (
    <figure
      className={['nest-scene', `nest-scene--${border}`, className].filter(Boolean).join(' ')}
      style={{ width }}
      data-testid="nest-scene"
      data-level={look.level}
    >
      <svg viewBox="0 0 200 160" role="img" aria-label={describeNest(look)}>
        <rect x="0" y="0" width="200" height="160" fill={`var(--nest-${background})`} />
        <Backdrop background={background} />
        {decorations.has('deco-star') ? <Star x={168} y={30} r={11} /> : null}
        {decorations.has('deco-flower') ? <Flower x={32} y={44} /> : null}
        <NestBack />
        <Bird level={look.level} />
        <NestFront />
        {decorations.has('deco-egg') ? <Egg x={150} y={116} /> : null}
        {decorations.has('deco-leaf') ? <Leaf x={44} y={116} /> : null}
        {decorations.has('deco-feather') ? <Feather x={168} y={96} /> : null}
      </svg>
    </figure>
  );
}

/** 배경마다 작은 무늬: 풀밭은 땅, 밤하늘은 별, 벚꽃은 꽃잎, 노을은 해 */
function Backdrop({ background }: { background: string }) {
  switch (background) {
    case 'bg-meadow':
      return <ellipse cx="100" cy="168" rx="130" ry="34" fill="var(--nest-ground)" />;
    case 'bg-night':
      return (
        <g fill="var(--deco-star)">
          <circle cx="24" cy="22" r="1.6" />
          <circle cx="62" cy="40" r="1.2" />
          <circle cx="140" cy="16" r="1.4" />
          <circle cx="182" cy="62" r="1.2" />
          <circle cx="40" cy="74" r="1" />
          <path d="M150 34 a12 12 0 1 0 10 18 a9 9 0 1 1 -10 -18z" />
        </g>
      );
    case 'bg-cherry':
      return (
        <g fill="var(--deco-flower)" opacity="0.55">
          <ellipse cx="30" cy="24" rx="4" ry="2.4" transform="rotate(30 30 24)" />
          <ellipse cx="78" cy="14" rx="4" ry="2.4" transform="rotate(-20 78 14)" />
          <ellipse cx="128" cy="30" rx="4" ry="2.4" transform="rotate(50 128 30)" />
          <ellipse cx="186" cy="20" rx="4" ry="2.4" transform="rotate(10 186 20)" />
          <ellipse cx="16" cy="88" rx="4" ry="2.4" transform="rotate(-40 16 88)" />
        </g>
      );
    case 'bg-sunset':
      return <circle cx="100" cy="150" r="70" fill="var(--bird-beak)" opacity="0.35" />;
    case 'bg-sky':
      return (
        <g fill="var(--color-surface)" opacity="0.8">
          <ellipse cx="44" cy="30" rx="20" ry="8" />
          <ellipse cx="58" cy="26" rx="14" ry="8" />
          <ellipse cx="150" cy="48" rx="18" ry="7" />
        </g>
      );
    default:
      return null;
  }
}

/** 둥지 뒤쪽(새 뒤에 그림) */
function NestBack() {
  return (
    <g>
      <ellipse cx="100" cy="112" rx="70" ry="14" fill="var(--nest-twig-dark)" />
      <path
        d="M34 110 Q60 100 100 102 Q140 100 166 110"
        fill="none"
        stroke="var(--nest-twig-light)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>
  );
}

/** 둥지 앞쪽(새 아랫부분을 가림): 가지를 엇갈려 엮은 그릇 모양 */
function NestFront() {
  const twigs = [
    'M26 112 Q100 128 174 112',
    'M30 120 Q100 112 170 124',
    'M34 128 Q96 142 166 126',
    'M40 134 Q104 128 160 140',
    'M50 142 Q100 150 150 140',
    'M24 114 Q60 140 98 146',
    'M176 114 Q140 140 102 146',
  ];
  return (
    <g>
      <path d="M26 112 Q32 150 100 152 Q168 150 174 112 Q100 126 26 112z" fill="var(--nest-twig)" />
      {twigs.map((d, i) => (
        <path
          key={d}
          d={d}
          fill="none"
          stroke={i % 2 === 0 ? 'var(--nest-twig-light)' : 'var(--nest-twig-dark)'}
          strokeWidth={i % 3 === 0 ? 3 : 2}
          strokeLinecap="round"
        />
      ))}
      <path
        d="M22 110 L12 104 M178 110 L190 102 M60 150 L54 158 M140 150 L148 158"
        stroke="var(--nest-twig)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </g>
  );
}

/** 참새. 단계마다 크기가 60%·70%·80%·90%·100% */
function Bird({ level }: { level: number }) {
  const step = Math.min(5, Math.max(1, Math.round(level)));
  const scale = 0.5 + step * 0.1;
  return (
    <g transform={`translate(100 118) scale(${scale})`} data-testid="nest-bird">
      <path d="M-30 -42 L-60 -60 L-52 -30 z" fill="var(--bird-head)" />
      <ellipse cx="0" cy="-34" rx="38" ry="30" fill="var(--bird-body)" />
      <ellipse cx="10" cy="-26" rx="22" ry="20" fill="var(--bird-belly)" />
      <ellipse
        cx="-12"
        cy="-38"
        rx="22"
        ry="12"
        fill="var(--bird-head)"
        transform="rotate(-18 -12 -38)"
      />
      <circle cx="20" cy="-68" r="22" fill="var(--bird-head)" />
      <circle cx="30" cy="-58" r="7" fill="var(--bird-belly)" />
      <circle cx="27" cy="-72" r="3.4" fill="var(--bird-eye)" />
      <path d="M40 -70 L54 -64 L40 -59 z" fill="var(--bird-beak)" />
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
