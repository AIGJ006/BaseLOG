import type { CSSProperties } from 'react';
import type { NestLook } from '../../api/nest';
import { artUrl } from './nestArt';
import { describeNest } from './nestItems';
import './nest.css';

/**
 * 둥지 그림 (021). 민서 님 픽셀 그림으로 그린다: 배경 위에 고른 둥지, 그 안에 앉은 새(1~4단계), 새가 쓴 장식.
 * 둥지는 같은 그림을 두 번 놓는다 — 뒤쪽은 통째로, 앞쪽은 아래 절반만 새 위에 덮어서 새가 둥지 안에 앉아 보이게 한다.
 * 자리는 모두 그림 칸에 대한 %라 크기가 달라도 모습이 같다. 배경색은 `tokens.css`의 둥지 토큰(라이트·다크 쌍)만 쓴다.
 */
export interface NestSceneProps {
  look: Pick<NestLook, 'level' | 'levelName' | 'background' | 'nestType' | 'decorations'>;
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

/**
 * 둥지 그림 원본 너비(px) — 기본 둥지가 그림 칸 너비의 60%가 되게 같은 비율로 줄인다. 앞쪽 덮개는 그림 위에서 `front`부터.
 * `bird`는 새 자리를 옮기는 값(%) — 별 둥지는 조금 아래로.
 */
const NESTS: Record<
  string,
  { width: number; bottom: number; front: number; bird?: [number, number] }
> = {
  'nest-basic': { width: 150, bottom: 5, front: 0.55 },
  'nest-flower': { width: 159, bottom: 4, front: 0.58 },
  'nest-leaf': { width: 165, bottom: 3, front: 0.56 },
  'nest-snow': { width: 147, bottom: 1, front: 0.5 },
  'nest-ribbon': { width: 136, bottom: 2, front: 0.45 },
  'nest-star': { width: 145, bottom: 0, front: 0.55, bird: [0, -3] },
};
const NEST_SCALE = 60 / 150;

/**
 * 앞쪽 덮개의 윗선 — 곧은 선으로 자르면 새 배가 칼로 자른 듯 보여서, 둥지 앞 테두리처럼 가운데가 깊고 양옆이 올라간 곡선으로 자른다.
 */
function frontClip(front: number): string {
  const points = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => {
    const d = (x - 50) / 50;
    return `${x}% ${((front - 0.2 * d * d) * 100).toFixed(1)}%`;
  });
  return `polygon(${points.join(', ')}, 100% 100%, 0% 100%)`;
}

/**
 * 새 단계마다 그림 칸에서의 자리와, 새 그림 안의 머리 꼭대기 자리(새 그림에 대한 비율).
 * `width`·`left`는 그림 칸 너비에 대한 %, `bottom`은 높이에 대한 %.
 */
interface BirdPose {
  width: number;
  left: number;
  bottom: number;
  head: [number, number];
  headWidth: number;
}
const BIRDS: BirdPose[] = [
  {
    width: 30,
    left: 35,
    bottom: 24,
    head: [0.53, 0.03],
    headWidth: 0.75,
  },
  {
    width: 40,
    left: 27,
    bottom: 25,
    head: [0.66, 0.02],
    headWidth: 0.65,
  },
  {
    width: 45.5,
    left: 21,
    bottom: 24,
    head: [0.72, 0.02],
    headWidth: 0.54,
  },
  {
    width: 50,
    left: 17,
    bottom: 23,
    head: [0.74, 0.02],
    headWidth: 0.45,
  },
];

/** 새 장식(머리에 쓰는 것): 얼마나 크게(머리 너비에 대한 배수), 그림의 어느 점을 머리 꼭대기에 맞출지(%) */
const WEAR: Record<string, { size: number; shift: [number, number] }> = {
  'acc-flower-crown': { size: 0.85, shift: [-50, -55] },
  'acc-ribbon': { size: 0.48, shift: [-10, -55] },
  'acc-crown': { size: 0.5, shift: [-50, -72] },
  'acc-flower-pin': { size: 0.36, shift: [-120, -20] },
};

export default function NestScene({ look, width = 200, className }: NestSceneProps) {
  const background = BACKGROUNDS.has(look.background) ? look.background : 'bg-basic';
  const nestType = look.nestType in NESTS ? look.nestType : 'nest-basic';
  const nest = NESTS[nestType];
  const stage = Math.min(4, Math.max(1, Math.round(look.level)));
  const pose = BIRDS[stage - 1];
  const [birdDx, birdDy] = nest.bird ?? [0, 0];
  const decorations = look.decorations.filter((code) => artUrl(code));
  const nestStyle: CSSProperties = {
    width: `${nest.width * NEST_SCALE}%`,
    left: `${50 - (nest.width * NEST_SCALE) / 2}%`,
    bottom: `${nest.bottom}%`,
  };
  return (
    <figure
      className={['nest-scene', `nest-scene--${background}`, className].filter(Boolean).join(' ')}
      style={{ width }}
      data-testid="nest-scene"
      data-level={stage}
    >
      <div
        className="nest-scene__stage"
        role="img"
        aria-label={describeNest({ ...look, nestType })}
      >
        <img
          src={artUrl(nestType)}
          alt=""
          className="nest-scene__thing"
          style={nestStyle}
          data-testid="nest-type"
          data-code={nestType}
        />
        <div
          className="nest-scene__bird"
          style={{
            width: `${pose.width}%`,
            left: `${pose.left + birdDx}%`,
            bottom: `${pose.bottom + birdDy}%`,
          }}
          data-testid="nest-bird"
          data-stage={stage}
        >
          <img src={artUrl(`bird-${stage}`)} alt="" />
          {decorations
            .filter((code) => code in WEAR)
            .map((code) => {
              const wear = WEAR[code];
              const [x, y] = pose.head;
              return (
                <img
                  key={code}
                  src={artUrl(code)}
                  alt=""
                  data-testid={code}
                  className="nest-scene__thing"
                  style={{
                    left: `${x * 100}%`,
                    top: `${y * 100}%`,
                    width: `${pose.headWidth * wear.size * 100}%`,
                    transform: `translate(${wear.shift[0]}%, ${wear.shift[1]}%)`,
                  }}
                />
              );
            })}
        </div>
        <img
          src={artUrl(nestType)}
          alt=""
          className="nest-scene__thing"
          style={{ ...nestStyle, clipPath: frontClip(nest.front) }}
        />
      </div>
    </figure>
  );
}
