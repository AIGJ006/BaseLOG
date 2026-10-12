import SiteNewsPage from '../features/site-news/SiteNewsPage';
import { NOTICES } from '../features/site-news/siteNews';

/** 공지 (머리말 로고 옆 [공지], 2026-10-12 민서 요청). 글은 `features/site-news/notices/*.md`. */
export default function NoticesPage() {
  return (
    <SiteNewsPage
      title="공지"
      intro="BaseLOG 운영 소식을 알려 드려요."
      notes={NOTICES}
      basePath="/notices"
    />
  );
}
