import type { CSSProperties } from 'react';
import type { NestLook } from '../../api/nest';
import { artUrl } from './nestArt';
import { describeNest } from './nestItems';
import './nest.css';

/**
 * 둥지 그림 (021). 민서 님 픽셀 그림으로 그린다: 배경 위에 고른 둥지, 그 안에 앉은 새(1~4단계), 새가 쓴 장식.
 * 둥지는 같은 그림을 두 번 놓는다 — 뒤쪽은 통째로, 앞쪽은 아래 절반만 새 위에 덮어서 새가 둥지 안에 앉아 보이게 한다.
 * 자리는 모두 그림 칸에 대한 %라 크기가 달라도 모습이 같다. 기본 배경색은 `tokens.css`의 둥지 토큰(라이트·다크 쌍)만 쓰고, 계절 배경은 그림
 * (`art/bg-<계절>.webp`)을 깐다 — 그림에 땅이 있어 언덕은 그리지 않는다.
 */
export interface NestSceneProps {
  look: Pick<NestLook, 'level' | 'levelName' | 'background' | 'nestType' | 'decorations'>;
  /** 그림 너비(px 숫자 또는 CSS 값). 높이는 0.8배 */
  width?: number | string;
  className?: string;
}

/** 계절 그림 배경 (2026-10-16 민서 님 픽셀 그림, 포인트로 산다). 그 밖의 코드는 기본 배경(하늘색 + 초록 바닥) */
const BACKGROUNDS = new Set(['bg-spring', 'bg-summer', 'bg-autumn', 'bg-winter']);

/**
 * 둥지 그림 원본 너비(px) — 기본 둥지가 그림 칸 너비의 60%가 되게 같은 비율로 줄인다. 앞쪽 덮개는 그림 위에서 `front`부터.
 * `bird`는 새 자리를 옮기는 값(%) — 별 둥지는 조금 아래로.
 */
const NESTS: Record<
  string,
  { width: number; bottom: number; front: number; bird?: [number, number] }
> = {
  'nest-basic': { width: 150, bottom: 5, front: 0.6 },
  'nest-flower': { width: 153, bottom: 4, front: 0.6 },
  'nest-leaf': { width: 148, bottom: 3, front: 0.6 },
  'nest-snow': { width: 148, bottom: 1, front: 0.5 },
  'nest-ribbon': { width: 142, bottom: 2, front: 0.55 },
  'nest-autumn': { width: 152, bottom: 3, front: 0.62 },
  'nest-star': { width: 150, bottom: 0, front: 0.65, bird: [0, -3] },
};
const NEST_SCALE = 60 / 150;

/**
 * 앞쪽 덮개의 윗선 — 곧은 선으로 자르면 새 배가 칼로 자른 듯 보여서, 둥지 앞 테두리처럼 가운데가 깊고 오른쪽이 올라간 곡선으로 자른다.
 * 왼쪽은 2단계부터 새 꼬리·날개 끝이 둥지 밖으로 나와서(2026-10-16 민서 "둥지랑 날개랑 겹침") 올리지 않고 조금 내려, 날개가 둥지 앞
 * 잎에 가려지지 않게 한다.
 */
function frontClip(front: number): string {
  const points = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((x) => {
    const d = (x - 50) / 50;
    const edge = d < 0 ? 0.25 * d * d : -0.2 * d * d;
    return `${x}% ${((front + edge) * 100).toFixed(1)}%`;
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
    bottom: 28,
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

/**
 * 선글라스(얼굴 칸): 민서 님이 그려 준 착용 그림(옆에서 본 모습)을 새 단계마다 따로 잘라 둔 `art/<코드>-<단계>.png`를 쓴다.
 * 단계마다 [왼쪽, 위, 너비] — 새 그림에 대한 %. 상점 그림은 앞에서 본 `art/<코드>.png`.
 */
const STAGED: Record<string, ([number, number, number] | null)[]> = {
  'acc-heart-glasses': [
    [37.7, 14.4, 64.4],
    [52.0, 7.8, 52.2],
    [62.5, 6.5, 44.4],
    [62.5, 3.9, 42.1],
  ],
  'acc-pixel-glasses': [
    [38.7, 17.7, 64.9],
    [52.3, 10.7, 52.7],
    [63.2, 8.2, 45.3],
    [62.9, 4.2, 44.2],
  ],
};

export default function NestScene({ look, width = 200, className }: NestSceneProps) {
  const background = BACKGROUNDS.has(look.background) ? look.background : 'bg-basic';
  const picture = background === 'bg-basic' ? undefined : artUrl(background);
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
        style={picture ? { backgroundImage: `url(${picture})` } : undefined}
        data-picture={picture ? background : undefined}
        role="img"
        aria-label={describeNest({ ...look, background, nestType })}
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
          {Object.keys(STAGED)
            .filter((code) => decorations.includes(code) && STAGED[code][stage - 1])
            .map((code) => {
              const [left, top, wide] = STAGED[code][stage - 1] ?? [0, 0, 0];
              return (
                <img
                  key={code}
                  src={artUrl(`${code}-${stage}`)}
                  alt=""
                  data-testid={code}
                  className="nest-scene__thing"
                  style={{ left: `${left}%`, top: `${top}%`, width: `${wide}%` }}
                />
              );
            })}
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
