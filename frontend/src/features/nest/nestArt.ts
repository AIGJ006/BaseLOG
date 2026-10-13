/**
 * 둥지 그림 파일 (021). 민서 님이 그린 픽셀 그림(2026-10-13)을 물건마다 배경을 지워 잘라 둔 것 — `art/<물건 코드>.png`, 새는
 * `art/bird-<단계>.png`.
 */
const files = import.meta.glob<string>('./art/*.png', {
  eager: true,
  import: 'default',
  query: '?url',
});

const ART: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.slice('./art/'.length, -'.png'.length), url]),
);

/** 물건 코드(또는 `bird-1`~`bird-4`)의 그림 주소. 없으면 `undefined` */
export function artUrl(code: string): string | undefined {
  return ART[code];
}
