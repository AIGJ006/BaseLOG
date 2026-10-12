import SiteNewsPage from '../features/site-news/SiteNewsPage';
import { RELEASES } from '../features/site-news/siteNews';

/** 업데이트 소식 = 릴리스 노트 (머리말 [공지] 옆, 2026-10-12 민서 요청). 글은 `features/site-news/releases/vX.Y.Z.md`. */
export default function ReleasesPage() {
  return (
    <SiteNewsPage
      title="업데이트 소식"
      intro="BaseLOG에서 새로 생기고 바뀐 것들이에요."
      notes={RELEASES}
      showId
    />
  );
}
