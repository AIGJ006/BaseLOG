import { NavLink } from 'react-router-dom';
import { ADMIN_TEXT } from './adminText';
import './admin.css';

/** 관리자 화면 위쪽 메뉴: 신고 관리 · 문의 · 회원 목록 · 통계. 회원 한 명 화면(`/admin/members/:handle`)에서도 회원 목록이 켜진다. */
export default function AdminNav() {
  return (
    <nav className="admin-nav" aria-label={ADMIN_TEXT.navLabel}>
      <NavLink to="/admin/reports">{ADMIN_TEXT.reportsTitle}</NavLink>
      <NavLink to="/admin/inquiries">{ADMIN_TEXT.inquiriesTitle}</NavLink>
      <NavLink to="/admin/members">{ADMIN_TEXT.membersTitle}</NavLink>
      <NavLink to="/admin/stats">{ADMIN_TEXT.statsTitle}</NavLink>
    </nav>
  );
}
