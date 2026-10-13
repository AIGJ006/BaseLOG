import type { AttendanceResult, MyNest, NestLook, ShopItem } from '../../../api/nest';

export function look(overrides: Partial<NestLook> = {}): NestLook {
  return {
    level: 2,
    levelName: '꼬마 새',
    streakDays: 4,
    background: 'bg-basic',
    border: 'border-none',
    decorations: [],
    ...overrides,
  };
}

const CATALOG: Array<[string, ShopItem['kind'], string, number]> = [
  ['bg-basic', 'BACKGROUND', '기본 숲', 0],
  ['bg-sunset', 'BACKGROUND', '노을', 150],
  ['bg-night', 'BACKGROUND', '밤하늘', 250],
  ['border-none', 'BORDER', '테두리 없음', 0],
  ['border-gold', 'BORDER', '금빛 테두리', 300],
  ['deco-egg', 'DECORATION', '알', 80],
  ['deco-star', 'DECORATION', '별', 120],
];

export function myNest(overrides: Partial<MyNest> = {}, owned: string[] = []): MyNest {
  const nest = overrides.nest ?? look();
  return {
    nest,
    balance: 200,
    attendedToday: true,
    bestStreakDays: 6,
    daysToGrow: 2,
    today: [
      { reason: 'POST', count: 1, cap: 3, points: 20 },
      { reason: 'COMMENT', count: 0, cap: 5, points: 5 },
      { reason: 'LIKE_RECEIVED', count: 2, cap: 20, points: 2 },
    ],
    items: CATALOG.map(([code, kind, name, price]) => ({
      code,
      kind,
      name,
      price,
      owned: price === 0 || owned.includes(code),
      equipped: code === nest.background || code === nest.border || nest.decorations.includes(code),
    })),
    ...overrides,
  };
}

export function attendance(
  me: MyNest,
  attended = true,
  pointsGained = 10,
  grew = false,
): AttendanceResult {
  return { attended, pointsGained, grew, me };
}
