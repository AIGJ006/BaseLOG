import type { AttendanceResult, MyNest, NestLook, ShopItem } from '../../../api/nest';

export function look(overrides: Partial<NestLook> = {}): NestLook {
  return {
    level: 2,
    levelName: '꼬마 새',
    streakDays: 4,
    background: 'bg-basic',
    nestType: 'nest-basic',
    decorations: [],
    ...overrides,
  };
}

const CATALOG: Array<[string, ShopItem['kind'], string, number, ShopItem['slot']]> = [
  ['bg-basic', 'BACKGROUND', '기본 숲', 0, null],
  ['bg-sunset', 'BACKGROUND', '노을', 150, null],
  ['bg-night', 'BACKGROUND', '밤하늘', 250, null],
  ['nest-basic', 'NEST', '기본 둥지', 0, null],
  ['nest-star', 'NEST', '별 둥지', 300, null],
  ['prop-stone', 'PROP', '돌', 30, null],
  ['acc-hat', 'ACCESSORY', '모자', 120, 'HEAD'],
  ['acc-crown', 'ACCESSORY', '왕관', 300, 'HEAD'],
  ['acc-heart', 'ACCESSORY', '하트', 50, null],
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
    items: CATALOG.map(([code, kind, name, price, slot]) => ({
      code,
      kind,
      name,
      price,
      slot,
      owned: price === 0 || owned.includes(code),
      equipped:
        code === nest.background || code === nest.nestType || nest.decorations.includes(code),
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
