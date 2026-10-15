/** 통계 화면 숫자·날짜 표기. */
export const statNumber = new Intl.NumberFormat('ko-KR');

/** `2026-10-14` → `10/14` */
export function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** `2026-10-14` → `2026년 10월 14일` */
export function longDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}
