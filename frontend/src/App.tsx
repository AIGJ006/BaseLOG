import { lazy, Suspense, useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { onNotFound } from './api/client';
import { GuestOnlyGate } from './features/auth/GuestOnlyGate';
import { ReagreementGate } from './features/auth/ReagreementGate';
import AppLayout from './components/AppLayout';
import BirdCursor from './components/BirdCursor';
import DetailDeleteButton from './features/manage-posts/DetailDeleteButton';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ManagePostsPage from './pages/ManagePostsPage';
import ManageCategoriesPage from './pages/ManageCategoriesPage';
import ManageNestLayout from './pages/ManageNestLayout';
import ManageStatsPage from './pages/ManageStatsPage';
import BlogPage from './pages/BlogPage';
import FriendsPage from './pages/FriendsPage';
import NestPage from './pages/NestPage';
import NotFoundPage from './pages/NotFoundPage';
import NotificationsPage from './pages/NotificationsPage';
import PostDetailPage from './pages/PostDetailPage';
import VisibilitySelect from './features/visibility/VisibilitySelect';
import AdminRouteGate from './features/auth-gate/AdminRouteGate';
import AdminInquiriesPage, { AdminInquiryPage } from './pages/admin/AdminInquiriesPage';
import AdminMemberPage from './pages/admin/AdminMemberPage';
import AdminMembersPage from './pages/admin/AdminMembersPage';
import AdminReportDetailPage from './pages/admin/AdminReportDetailPage';
import AdminReportsPage from './pages/admin/AdminReportsPage';
import AdminStatsPage from './pages/admin/AdminStatsPage';
import type { AuthorActionContext } from './features/post-detail/AuthorActions';
import { COLLABORATORS_NO_PRIVATE } from './features/collaborators/collaboratorSelection';
import PrivacyPage from './pages/PrivacyPage';
import NoticesPage from './pages/NoticesPage';
import ReleasesPage from './pages/ReleasesPage';
import ReagreementPage from './pages/ReagreementPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import SettingsPage from './pages/SettingsPage';
import SignupPage from './pages/SignupPage';
import SupportPage from './pages/SupportPage';
import SocialSignupPage from './pages/SocialSignupPage';
import TagIndexPage from './pages/TagIndexPage';
import TagPage from './pages/TagPage';
import TermsPage from './pages/TermsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import { RestoreGate } from './features/withdraw/RestoreGate';
import RestorePage from './pages/RestorePage';
import SearchPage from './pages/SearchPage';
import WithdrawnPage from './pages/WithdrawnPage';
import WithdrawPage from './pages/WithdrawPage';

/**
 * 에디터(002)는 따로 불러온다 (005 T075, FR-031). 에디터가 정적으로 묶이면 에디터 미리보기가 쓰는 코드 강조(highlight.js)도
 * 첫 번들에 함께 들어가 글을 읽기만 하는 사람도 받게 된다. 에디터를 나누면 코드 강조는 별도 청크가 되고, 글 상세는 코드 블록이
 * 있을 때만 그 청크를 부른다(`features/post-detail/loadHighlighter.ts`).
 */
const EditorPage = lazy(() => import('./pages/EditorPage'));
const NewPostPage = lazy(() =>
  import('./pages/EditorPage').then((module) => ({ default: module.NewPostPage })),
);

/** 에디터 청크를 받는 동안 */
function EditorLoading() {
  return (
    <main data-route="editor-loading" aria-busy="true">
      불러오는 중…
    </main>
  );
}

/**
 * 004: 글 상세 작성자 버튼 줄의 [공개 범위 ▾] 자리 (005 `visibilityControl`). 고르는 즉시 저장하고 상세를 다시 부른다 —
 * 다시 발행하지 않아 "수정됨"이 생기지 않는다(FR-016).
 */
function renderDetailVisibility({
  postId,
  visibility,
  reload,
  collaboratorCount = 0,
}: AuthorActionContext) {
  // 공동 작업자가 있는 글은 나만 보기로 바꿀 수 없다 (서버도 400으로 막는다)
  return (
    <VisibilitySelect
      postId={postId}
      value={visibility}
      onSaved={reload}
      disabledValues={collaboratorCount > 0 ? ['PRIVATE'] : []}
      disabledHint={COLLABORATORS_NO_PRIVATE}
    />
  );
}

/** 006: 글 상세 작성자 버튼 줄의 [삭제] 자리 (005 `deleteControl`) */
function renderDetailDelete({ postId, reload }: { postId: number; reload: () => void }) {
  return <DetailDeleteButton postId={postId} reload={reload} />;
}

export default function App() {
  const location = useLocation();
  // API가 404 NOT_FOUND를 주면 지금 화면 대신 공통 404 화면을 보인다(004 T024·T025). 다른 주소로 옮기면 풀린다.
  const [notFoundAt, setNotFoundAt] = useState<string | null>(null);

  useEffect(() => onNotFound(() => setNotFoundAt(location.key)), [location.key]);

  return (
    // 세션 + 공통 머리말로 모든 경로를 한 번에 감싼다 (AppLayout)
    <AppLayout>
      <BirdCursor />
      {/* 015: 탈퇴 유예 세션은 재동의보다 먼저 복구 화면으로 */}
      <RestoreGate>
        <ReagreementGate>
          {notFoundAt !== null && notFoundAt === location.key ? (
            <NotFoundPage />
          ) : (
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route
                path="/signup"
                element={
                  <GuestOnlyGate>
                    <SignupPage />
                  </GuestOnlyGate>
                }
              />
              <Route path="/signup/social" element={<SocialSignupPage />} />
              <Route
                path="/login"
                element={
                  <GuestOnlyGate>
                    <LoginPage />
                  </GuestOnlyGate>
                }
              />
              <Route path="/verify-email" element={<VerifyEmailPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/reagree" element={<ReagreementPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              {/* 015 회원 탈퇴·완료·복구 */}
              <Route path="/settings/withdraw" element={<WithdrawPage />} />
              <Route path="/withdrawn" element={<WithdrawnPage />} />
              <Route path="/account/restore" element={<RestorePage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/notices" element={<NoticesPage />} />
              <Route path="/notices/:id" element={<NoticesPage />} />
              <Route path="/releases" element={<ReleasesPage />} />
              <Route path="/releases/:id" element={<ReleasesPage />} />
              <Route
                path="/write/new"
                element={
                  <Suspense fallback={<EditorLoading />}>
                    <NewPostPage />
                  </Suspense>
                }
              />
              <Route
                path="/write/:postId"
                element={
                  <Suspense fallback={<EditorLoading />}>
                    <EditorPage />
                  </Suspense>
                }
              />
              {/* 내 둥지 관리(2026-10-15): 왼쪽 탭 [글]·[카테고리]·[통계]·[휴지통]. 사용자를 가리키는 값 없이 본인 것만 (006 FR-002, 017) */}
              <Route path="/manage" element={<ManageNestLayout />}>
                <Route index element={<Navigate to="/manage/posts" replace />} />
                <Route path="posts" element={<ManagePostsPage />} />
                <Route path="categories" element={<ManageCategoriesPage />} />
                <Route path="stats" element={<ManageStatsPage />} />
                <Route path="trash" element={<ManagePostsPage section="trash" />} />
              </Route>
              {/* 친구 화면(피드·받은 요청·내 친구) — 로그인 회원만. 비로그인은 화면이 로그인으로 보낸다 */}
              <Route path="/friends" element={<FriendsPage />} />
              {/* 021 새 키우기(꾸미기 포함) — 로그인 회원만 */}
              <Route path="/nest" element={<NestPage />} />
              {/* 023 문의·신고(보내기 + 내가 보낸 문의) — 로그인 회원만 */}
              <Route path="/support" element={<SupportPage />} />
              {/* 010 옛 피드 주소는 친구 화면의 피드 탭으로 */}
              <Route path="/feed" element={<Navigate to="/friends" replace />} />
              {/* 011 알림 — 로그인 회원만. 비로그인은 화면이 로그인으로 보낸다 */}
              <Route path="/notifications" element={<NotificationsPage />} />
              {/* 004 관리자 화면 가드 — 비로그인은 로그인으로, 일반 회원은 공통 404. 하위 화면은 014 */}
              <Route path="/admin" element={<AdminRouteGate />}>
                <Route index element={<Navigate to="/admin/reports" replace />} />
                <Route path="reports" element={<AdminReportsPage />} />
                <Route path="reports/:caseId" element={<AdminReportDetailPage />} />
                <Route path="inquiries" element={<AdminInquiriesPage />} />
                <Route path="inquiries/:inquiryId" element={<AdminInquiryPage />} />
                <Route path="members" element={<AdminMembersPage />} />
                <Route path="members/:handle" element={<AdminMemberPage />} />
                <Route path="stats" element={<AdminStatsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
              {/* 012 검색 — `?q&tab&sort` */}
              <Route path="/search" element={<SearchPage />} />
              {/* 008 태그 — `/:handle`보다 앞에 둔다. `:name`은 react-router가 디코드해 준다(`c%23` → `c#`) */}
              <Route path="/tags" element={<TagIndexPage />} />
              <Route path="/tags/:name" element={<TagPage />} />
              {/* 005 글 상세 — react-router는 `/@:handle`처럼 구간 일부만 파라미터로 받지 못해 `@`는 화면이 떼어 낸다 */}
              <Route
                path="/:handle/posts/:postId"
                element={
                  <PostDetailPage
                    visibilityControl={renderDetailVisibility}
                    deleteControl={renderDetailDelete}
                  />
                }
              />
              <Route path="/:handle" element={<BlogPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          )}
        </ReagreementGate>
      </RestoreGate>
    </AppLayout>
  );
}
