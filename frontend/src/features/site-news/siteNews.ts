import { noteId, parseNote, sortNotes, type Note } from './parseNote';

/** 빌드할 때 `notices/*.md`·`releases/*.md`를 글자 그대로 묶어 넣는다(서버 호출 없음). */
const noticeFiles = import.meta.glob<string>('./notices/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const releaseFiles = import.meta.glob<string>('./releases/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** 글에 넣는 그림(`releases/images/vX.Y.Z/*.png` 등). 빌드가 파일마다 주소를 붙여 준다 */
const imageFiles = import.meta.glob<string>('./*/images/**/*.{png,jpg,jpeg,webp}', {
  query: '?url',
  import: 'default',
  eager: true,
});

/** 글 파일 폴더(`./releases/`) 기준 상대 경로를 빌드된 주소로. 없는 그림은 null */
export function resolveImage(
  folder: string,
  src: string,
  files: Record<string, string> = imageFiles,
): string | null {
  return files[`${folder}${src.replace(/^\.\//, '')}`] ?? null;
}

function load(files: Record<string, string>): Note[] {
  return sortNotes(
    Object.entries(files).map(([path, source]) => {
      const note = parseNote(noteId(path), source);
      const folder = path.slice(0, path.lastIndexOf('/') + 1);
      note.blocks = note.blocks.map((block) =>
        block.kind === 'images'
          ? {
              ...block,
              images: block.images.map((image) => ({
                ...image,
                src: resolveImage(folder, image.src) ?? image.src,
              })),
            }
          : block,
      );
      return note;
    }),
  );
}

export const NOTICES: Note[] = load(noticeFiles);
export const RELEASES: Note[] = load(releaseFiles);
