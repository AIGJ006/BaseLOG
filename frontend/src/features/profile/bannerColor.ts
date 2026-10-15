import type { CSSProperties } from 'react';

/** 추천 색. 회원이 고르는 값(저장되는 데이터)이라 토큰이 아니라 #rrggbb 그대로 둔다. */
export const BANNER_COLOR_PRESETS: ReadonlyArray<{ value: string; name: string }> = [
  { value: '#69db7c', name: '연두' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
  { value: '#2f7d3a', name: '초록' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
  { value: '#74c0fc', name: '하늘' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
  { value: '#4263eb', name: '파랑' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
  { value: '#9775fa', name: '보라' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
  { value: '#f783ac', name: '분홍' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
  { value: '#ffa94d', name: '주황' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
  { value: '#ffd43b', name: '노랑' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
  { value: '#868e96', name: '회색' }, // raw-color-ok: 회원이 고르는 배너 추천 색(저장 값)
];

const HEX = /^#[0-9a-f]{6}$/;

/** `#RRGGBB`·`rrggbb`처럼 적어도 소문자 `#rrggbb`로. 틀리면 null. */
export function normalizeBannerColor(text: string): string | null {
  const trimmed = text.trim().toLowerCase();
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
  return HEX.test(withHash) ? withHash : null;
}

/** 색 칸 미리보기용 style (색 값은 데이터라 CSS 변수로 넘긴다). */
export function bannerColorStyle(color: string | null | undefined) {
  return color ? ({ '--banner-color': color } as CSSProperties) : undefined;
}
