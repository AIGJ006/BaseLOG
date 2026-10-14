import { useLocation } from 'react-router-dom';
import { GITHUB_ORG_URL, SITE_NAME } from '../config';
import './siteFooter.css';

/**
 * 모든 화면 맨 아래 꼬리말: GitHub Organization 아이콘 링크(새 탭).
 * 글쓰기 화면(`/write/…`)은 편집 칸이 화면을 채우므로 넣지 않는다.
 */
export default function SiteFooter() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/write/')) {
    return null;
  }
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <a
          className="site-footer-github"
          href={GITHUB_ORG_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${SITE_NAME} GitHub (새 탭)`}
          title="GitHub"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
            <path
              fill="currentColor"
              d="M12 2.5a9.5 9.5 0 0 0-3 18.52c.47.09.65-.2.65-.46v-1.6c-2.64.57-3.2-1.27-3.2-1.27-.43-1.1-1.06-1.4-1.06-1.4-.86-.59.07-.58.07-.58.95.07 1.45.98 1.45.98.85 1.45 2.22 1.03 2.76.79.09-.62.33-1.03.6-1.27-2.1-.24-4.32-1.05-4.32-4.68 0-1.03.37-1.88.98-2.54-.1-.24-.43-1.21.09-2.52 0 0 .8-.26 2.62.97a9.1 9.1 0 0 1 4.77 0c1.82-1.23 2.62-.97 2.62-.97.52 1.31.19 2.28.1 2.52.6.66.97 1.5.97 2.54 0 3.64-2.22 4.44-4.33 4.67.34.3.65.88.65 1.78v2.64c0 .26.17.56.66.46A9.5 9.5 0 0 0 12 2.5Z"
            />
          </svg>
        </a>
      </div>
    </footer>
  );
}
