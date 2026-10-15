import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { listMyPosts } from '../api/managePosts';
import TabIcon from '../components/TabIcon';
import type { ManageNestContext } from '../features/manage-posts/manageNestContext';
import '../features/manage-posts/manageNest.css';

const SECTIONS = [
  {
    to: '/manage/posts',
    label: '글',
    icon: <TabIcon d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  },
  {
    to: '/manage/categories',
    label: '카테고리',
    icon: <TabIcon d="M3 6h7l2 2h9v11H3zM3 10h18" />,
  },
  {
    to: '/manage/stats',
    label: '통계',
    icon: <TabIcon d="M4 20V11M10 20V5M16 20v-6M21 20H3" />,
  },
  {
    to: '/manage/trash',
    label: '휴지통',
    icon: <TabIcon d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />,
  },
] as const;

/**
 * 내 둥지 관리 `/manage/*` (2026-10-15 민서 요청, 옛 "내 글 관리"). 설정 화면처럼 왼쪽 세로 탭 [글] [카테고리] [통계] [휴지통]을 두고
 * 오른쪽에 고른 화면을 보인다. 들어오면 [글]이 먼저 열린다. 탭은 주소가 바뀌는 링크라 뒤로 가기·새로 고침에도 그대로다.
 * 폰에서는 탭이 위쪽 가로 한 줄이 된다.
 */
export default function ManageNestLayout() {
  const [trashCount, setTrashCount] = useState<number | null>(null);
  const context = useMemo<ManageNestContext>(() => ({ setTrashCount }), []);
  // 글·휴지통 화면은 목록을 부를 때 숫자를 알려 준다. 카테고리·통계로 바로 들어왔을 때만 휴지통 수를 한 번 따로 묻는다.
  const { pathname } = useLocation();
  const listsPosts = pathname === '/manage/posts' || pathname === '/manage/trash';
  const known = trashCount !== null;
  useEffect(() => {
    if (listsPosts || known) return;
    let cancelled = false;
    listMyPosts({ tab: 'trash' }).then(
      (page) => {
        if (!cancelled && page.counts) setTrashCount(page.counts.trash);
      },
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [listsPosts, known]);
  return (
    <main className="manage-nest-page">
      <header className="manage-nest-head">
        <h1>내 둥지 관리</h1>
        <p className="manage-nest-lead">글과 카테고리, 통계, 휴지통을 한곳에서 관리해요.</p>
      </header>
      <div className="manage-nest-layout">
        <nav className="manage-nest-nav" aria-label="내 둥지 관리">
          {SECTIONS.map(({ to, label, icon }) => (
            <NavLink key={to} to={to}>
              {icon}
              <span>{label}</span>
              {to === '/manage/trash' && trashCount !== null ? (
                <>
                  {' '}
                  <span className="manage-nest-count">{trashCount}</span>
                </>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="manage-nest-panel">
          <Outlet context={context} />
        </div>
      </div>
    </main>
  );
}
