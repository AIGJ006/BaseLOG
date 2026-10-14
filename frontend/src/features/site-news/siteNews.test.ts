import { describe, expect, it } from 'vitest';
import { NOTICES, RELEASES, resolveImage } from './siteNews';

describe('resolveImage', () => {
  const files = { './releases/images/v1.3.0/a.png': '/assets/a-123.png' };

  it('글 폴더 기준 상대 경로를 빌드된 주소로 바꾼다', () => {
    expect(resolveImage('./releases/', 'images/v1.3.0/a.png', files)).toBe('/assets/a-123.png');
    expect(resolveImage('./releases/', './images/v1.3.0/a.png', files)).toBe('/assets/a-123.png');
  });

  it('없는 그림은 null', () => {
    expect(resolveImage('./releases/', 'images/v1.3.0/b.png', files)).toBeNull();
  });
});

describe('글에 넣은 그림', () => {
  it('공지·업데이트 소식이 가리키는 그림 파일이 모두 있다', () => {
    const missing = [...NOTICES, ...RELEASES].flatMap((note) =>
      note.blocks.flatMap((block) =>
        block.kind === 'images'
          ? block.images
              .filter((image) => image.src.startsWith('images/') || image.src.startsWith('./'))
              .map((image) => `${note.id}: ${image.src}`)
          : [],
      ),
    );
    expect(missing).toEqual([]);
  });
});
