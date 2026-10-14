/**
 * 둥지 꾸미기 API (021 contracts/openapi.yaml). 요청은 공용 `client.ts`를 쓴다.
 */
import { apiGet, apiPost, apiPut } from './client';

export type NestItemKind = 'BACKGROUND' | 'NEST' | 'ACCESSORY';
export type NestPointReason =
  'ATTENDANCE' | 'STREAK_BONUS' | 'POST' | 'COMMENT' | 'LIKE_RECEIVED' | 'PURCHASE' | 'ADJUST';

/** 둥지 모습 — 누구나 본다. `level`은 오늘 기준(오래 빠졌으면 줄어든 값). */
export interface NestLook {
  level: number;
  levelName: string;
  streakDays: number;
  background: string;
  /** 장착한 둥지 코드 (처음엔 기본 둥지) */
  nestType: string;
  /** 장착한 새 장식 코드들 */
  decorations: string[];
}

export interface ShopItem {
  code: string;
  kind: NestItemKind;
  name: string;
  /** 0이면 기본 물건 (사지 않아도 가짐) */
  price: number;
  /** 새 장식 칸 (머리·얼굴·목에 하나씩). 칸이 없으면 null */
  slot: 'HEAD' | 'FACE' | 'NECK' | null;
  owned: boolean;
  equipped: boolean;
}

export interface TodayEarning {
  reason: 'POST' | 'COMMENT' | 'LIKE_RECEIVED';
  count: number;
  cap: number;
  points: number;
}

export interface MyNest {
  nest: NestLook;
  balance: number;
  attendedToday: boolean;
  bestStreakDays: number;
  /** 다음 성장까지 남은 출석 일수 (다 자랐으면 0) */
  daysToGrow: number;
  today: TodayEarning[];
  items: ShopItem[];
  /** 시험용 칸(새 단계 바꾸기·포인트 넣기)을 보이나 — 로컬 서버만 true */
  devTools?: boolean;
}

export interface AttendanceResult {
  /** 이번 요청으로 출석했나 (오늘 이미 했으면 false) */
  attended: boolean;
  pointsGained: number;
  grew: boolean;
  me: MyNest;
}

export interface PointEntry {
  id: number;
  reason: NestPointReason;
  label: string;
  amount: number;
  createdAt: string;
}

export interface PointHistory {
  items: PointEntry[];
  nextBefore: number | null;
}

export interface EquipRequest {
  background: string | null;
  nestType: string | null;
  decorations: string[];
}

export function getMyNest(): Promise<MyNest> {
  return apiGet<MyNest>('/api/me/nest');
}

export function attendNest(): Promise<AttendanceResult> {
  return apiPost<AttendanceResult>('/api/me/nest/attendance', {});
}

export function listNestPoints(before?: number | null): Promise<PointHistory> {
  return apiGet<PointHistory>(
    before ? `/api/me/nest/points?before=${before}` : '/api/me/nest/points',
  );
}

export function buyNestItem(code: string): Promise<MyNest> {
  return apiPost<MyNest>(`/api/me/nest/items/${encodeURIComponent(code)}`, {});
}

export function equipNest(request: EquipRequest): Promise<MyNest> {
  return apiPut<MyNest>('/api/me/nest/equipped', request);
}

/** 시험용: 내 새 단계를 바로 바꾼다 (로컬 서버만, 운영은 404) */
export function setNestLevelForTesting(level: number): Promise<MyNest> {
  return apiPut<MyNest>('/api/me/nest/dev/level', { level });
}

/** 시험용: 포인트를 넣는다 (로컬 서버만, 운영은 404) */
export function giveNestPointsForTesting(amount: number): Promise<MyNest> {
  return apiPost<MyNest>('/api/me/nest/dev/points', { amount });
}
