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
  'nest-basic': '기본 둥지',
  'nest-leaf': '나뭇잎 둥지',
  'nest-flower': '꽃 둥지',
  'nest-snow': '눈 둥지',
  'nest-ribbon': '리본 둥지',
  'nest-autumn': '단풍 둥지',
  'nest-star': '별 둥지',
  'acc-flower-crown': '꽃관',
  'acc-ribbon': '나비 리본',
  'acc-crown': '왕관',
  'acc-heart-glasses': '하트 선글라스',
  'acc-pixel-glasses': '픽셀 선글라스',
  'acc-straw-hat': '밀짚모자',
  'acc-flower-pin': '꽃핀',
};

/** 화면 읽기용 한 줄: "꼬마 새가 사는 꽃 둥지, 배경 노을, 장식 왕관·꽃핀" */
export function describeNest(look: {
  levelName: string;
  background: string;
  nestType: string;
  decorations: string[];
}): string {
  const nest = look.nestType.startsWith('nest-') ? NEST_ITEM_NAMES[look.nestType] : undefined;
  const parts = [`${look.levelName}가 사는 ${nest ?? '기본 둥지'}`];
  parts.push(`배경 ${NEST_ITEM_NAMES[look.background] ?? '기본 숲'}`);
  if (look.decorations.length > 0) {
    parts.push(`장식 ${look.decorations.map((code) => NEST_ITEM_NAMES[code] ?? code).join('·')}`);
  }
  return parts.join(', ');
}
