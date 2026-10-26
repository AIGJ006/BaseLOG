import { describe, expect, it } from 'vitest';
import { buildSiteNewsIndex, readEntry } from '../siteNewsIndex';

describe('siteNewsIndex', () => {
  it('머리 주석의 제목·날짜와 파일 이름 id를 읽는다', () => {
    const source =
      '<!-- target: abc -->\n<!-- title: BaseLOG 1.5.2 배포 이후 수정사항 -->\n<!-- date: 2026-10-21 -->\n\n본문 <!-- title: 아님 -->';

    expect(readEntry('v1.5.3.md', source)).toEqual({
      id: 'v1.5.3',
      title: 'BaseLOG 1.5.2 배포 이후 수정사항',
      date: '2026-10-21',
    });
  });

  it('본문이 시작된 뒤의 주석은 머리로 읽지 않는다', () => {
    const source = '<!-- date: 2026-10-21 -->\n\n본문\n<!-- title: 아님 -->';

    expect(readEntry('x.md', source)).toEqual({ id: 'x', title: '', date: '2026-10-21' });
  });

  it('머리 주석이 없으면 빈 글자', () => {
    expect(readEntry('x.md', '본문')).toEqual({ id: 'x', title: '', date: '' });
  });

  it('실제 공지·업데이트 소식 폴더를 모두 읽는다', () => {
    const root = 'src/features/site-news'; // vitest는 frontend/에서 돈다 (vite.config.ts와 같은 상대 경로)

    const index = buildSiteNewsIndex(root);

    expect(index.releases.map((entry) => entry.id)).toContain('v1.0.0');
    expect(index.notices.map((entry) => entry.id)).toContain('2026-10-12-open');
    expect(index.releases.every((entry) => entry.title !== '')).toBe(true);
  });
});
