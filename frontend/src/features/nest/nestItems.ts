/**
 * 꾸미기 물건 이름 (021, 서버 `NestItem`과 같은 목록). 남의 둥지 그림의 화면 읽기 설명에 쓴다 — 꾸미기 화면은 서버가 준 이름을 쓴다.
 */
export const NEST_ITEM_NAMES: Record<string, string> = {
  'bg-basic': '기본 숲',
  'bg-meadow': '풀밭',
  'bg-sky': '맑은 하늘',
  'bg-sunset': '노을',
  'bg-cherry': '벚꽃',
  'bg-night': '밤하늘',
  'border-none': '테두리 없음',
  'border-twig': '나뭇가지 테두리',
  'border-gold': '금빛 테두리',
  'deco-leaf': '나뭇잎',
  'deco-feather': '깃털',
  'deco-flower': '꽃',
  'deco-egg': '알',
  'deco-star': '별',
};

/** 화면 읽기용 한 줄: "꼬마 새가 사는 둥지, 배경 노을, 장식 알·별" */
export function describeNest(look: {
  levelName: string;
  background: string;
  decorations: string[];
}): string {
  const parts = [`${look.levelName}가 사는 둥지`];
  parts.push(`배경 ${NEST_ITEM_NAMES[look.background] ?? '기본 숲'}`);
  if (look.decorations.length > 0) {
    parts.push(`장식 ${look.decorations.map((code) => NEST_ITEM_NAMES[code] ?? code).join('·')}`);
  }
  return parts.join(', ');
}
