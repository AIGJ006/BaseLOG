import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  discardEditing,
  type ManagePostItem,
  type ManageTab,
  type VisibilityFilter,
} from '../api/managePosts';
import { createPost } from '../api/posts';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';
import { useSession } from '../features/auth/useSession';
import DraftRow from '../features/manage-posts/DraftRow';
import ManageTabs from '../features/manage-posts/ManageTabs';
import PublishedRow from '../features/manage-posts/PublishedRow';
import TrashRow from '../features/manage-posts/TrashRow';
import { DISCARD_CONFIRM, TRASH_NOTICE } from '../features/manage-posts/confirmDialogs';
import { useManagePosts } from '../features/manage-posts/useManagePosts';
import { useRowAction } from '../features/manage-posts/useRowAction';
import { useTrashActions } from '../features/manage-posts/useTrashActions';
import '../features/manage-posts/managePosts.css';
import { useManageNest } from '../features/manage-posts/manageNestContext';

const TABS: readonly ManageTab[] = ['drafts', 'published', 'trash'];
const FILTERS: { value: VisibilityFilter | null; label: string }[] = [
  { value: null, label: '전체' },
  { value: 'public', label: '공개' },
  { value: 'friends', label: '친구 공개' },
  { value: 'private', label: '비공개' },
];
const EMPTY: Record<ManageTab, string> = {
  drafts: '임시글이 없어요',
  published: '등록한 글이 없어요',
  trash: '휴지통이 비어 있어요',
};
const NEW_POST_FAILED = '새 글을 만들지 못했어요';

function parseTab(value: string | null): ManageTab {
  return TABS.includes(value as ManageTab) ? (value as ManageTab) : 'published';
}

function parseFilter(value: string | null): VisibilityFilter | null {
  return value === 'public' || value === 'friends' || value === 'private' ? value : null;
}

/**
 * 내 둥지 관리의 [글] `/manage/posts?tab=drafts|published&visibility=public|friends|private`와 [휴지통] `/manage/trash`
 * (006 T051·T070·T071, US3·US5). 탭을 지정하지 않으면 등록 글 탭이 먼저 열린다 (2026-10-12 민서 요청).
 * 옛 주소 `/manage/posts?tab=trash`는 `/manage/trash`로 보낸다(2026-10-15 휴지통을 왼쪽 탭으로 옮김).
 *
 * - 본인 글만 보인다 — 주소에 사용자를 가리키는 값이 없다(FR-002). 비회원은 로그인 화면으로 간다(FR-001).
 * - 처리 결과는 그 줄에만 반영하고 실패하면 그 줄 아래에 이유를 보인다(FR-013). 다시 불러온 목록에 그 줄이 없으면
 *   이유를 목록 위에 보인다.
 * - 검색·일괄 처리는 없다(FR-004, 41 M-10). 375px에서 버튼은 줄을 바꿔 가로 스크롤이 생기지 않는다.
 */
export default function ManagePostsPage({
  section = 'posts',
}: Readonly<{ section?: 'posts' | 'trash' }>) {
  const [params] = useSearchParams();
  if (section === 'posts' && params.get('tab') === 'trash') {
    return <Navigate to="/manage/trash" replace />;
  }
  return <ManagePostsSection section={section} />;
}

function ManagePostsSection({ section }: Readonly<{ section: 'posts' | 'trash' }>) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { me } = useSession();
  const tab: ManageTab = section === 'trash' ? 'trash' : parseTab(params.get('tab'));
  const visibility = tab === 'published' ? parseFilter(params.get('visibility')) : null;

  const list = useManagePosts({ tab, visibility });
  const { confirm, dialog } = useConfirm();
  const { show, toast } = useToast();
  useDraftSavedToast(show);
  const rowAction = useRowAction({ reload: list.reload });
  const actions = useTrashActions({
    confirm,
    rowAction,
    showToast: show,
    onRowRemoved: list.removeRow,
    onCountsChange: list.adjustCounts,
  });
  const [pageError, setPageError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const now = new Date();
  const nest = useManageNest();
  const trashCount = list.counts?.trash ?? null;
  useEffect(() => {
    nest?.setTrashCount(trashCount);
  }, [nest, trashCount]);

  const orphanErrors = useMemo(() => {
    const shown = new Set(list.items.map((row) => row.id));
    return [
      ...new Set(
        Object.entries(rowAction.rowErrors)
          .filter(([id]) => !shown.has(Number(id)))
          .map(([, message]) => message),
      ),
    ];
  }, [list.items, rowAction.rowErrors]);

  function select(nextTab: ManageTab, nextFilter: VisibilityFilter | null = null) {
    const next = new URLSearchParams({ tab: nextTab });
    if (nextTab === 'published' && nextFilter) {
      next.set('visibility', nextFilter);
    }
    setParams(next);
  }

  async function discard(row: ManagePostItem) {
    if (!(await confirm(DISCARD_CONFIRM))) {
      return;
    }
    await rowAction.run(row.id, () => discardEditing(row.id), {
      onSuccess: () => list.updateRow(row.id, { editing: false }),
    });
  }

  async function newPost() {
    setCreating(true);
    setPageError(null);
    try {
      const created = await createPost();
      navigate(`/write/${created.postId}`);
    } catch (caught) {
      setCreating(false);
      setPageError(caught instanceof ApiError ? caught.message : NEW_POST_FAILED);
    }
  }

  function renderRow(row: ManagePostItem) {
    const common = {
      row,
      busy: rowAction.isBusy(row.id),
      error: rowAction.rowErrors[row.id],
    };
    if (tab === 'trash') {
      return (
        <TrashRow
          key={row.id}
          {...common}
          now={now}
          onRestore={(r) => void actions.restore(r)}
          onPurge={(r) => void actions.purge(r)}
        />
      );
    }
    if (tab === 'published') {
      return (
        <PublishedRow
          key={row.id}
          {...common}
          handle={me?.handle ?? null}
          onTrash={(r) => void actions.trash(r)}
          onDiscard={(r) => void discard(r)}
        />
      );
    }
    return <DraftRow key={row.id} {...common} now={now} onTrash={(r) => void actions.trash(r)} />;
  }

  return (
    <section
      className="manage-page"
      data-route={section === 'trash' ? 'manage-trash' : 'manage-posts'}
    >
      <div className="manage-header">
        <h2>{section === 'trash' ? '휴지통' : '글'}</h2>
        {section === 'posts' ? (
          <button type="button" onClick={() => void newPost()} disabled={creating}>
            새 글
          </button>
        ) : null}
      </div>
      {pageError ? (
        <p className="manage-page-error" role="alert">
          {pageError}
        </p>
      ) : null}

      {section === 'posts' ? (
        <ManageTabs current={tab} counts={list.counts} onSelect={(next) => select(next)} />
      ) : null}

      <div
        id="manage-panel"
        {...(section === 'posts'
          ? { role: 'tabpanel', 'aria-labelledby': `manage-tab-${tab}` }
          : { 'aria-label': '휴지통 글' })}
      >
        {tab === 'published' ? (
          <VisibilityFilters
            current={visibility}
            onSelect={(value) => select('published', value)}
          />
        ) : null}
        {tab === 'trash' ? <p className="manage-notice">{TRASH_NOTICE}</p> : null}

        {orphanErrors.map((message) => (
          <p key={message} className="manage-row-error" role="alert">
            {message}
          </p>
        ))}
        {list.error ? (
          <p className="manage-page-error" role="alert">
            {list.error}
          </p>
        ) : null}

        <ManageListBody list={list} empty={EMPTY[tab]} renderRow={renderRow} />
      </div>
      {dialog}
      {toast}
    </section>
  );
}

/** 에디터 [임시저장]으로 나온 경우 알림을 띄운다 */
function useDraftSavedToast(show: ReturnType<typeof useToast>['show']) {
  const location = useLocation();
  const draftSaved = (location.state as { draftSaved?: unknown } | null)?.draftSaved === true;
  useEffect(() => {
    if (draftSaved) {
      show({ text: '임시저장했어요' });
    }
  }, [draftSaved, location.key, show]);
}

function VisibilityFilters({
  current,
  onSelect,
}: Readonly<{
  current: VisibilityFilter | null;
  onSelect: (value: VisibilityFilter | null) => void;
}>) {
  return (
    <fieldset className="manage-filters" aria-label="공개 범위">
      {FILTERS.map(({ value, label }) => (
        <button
          key={label}
          type="button"
          aria-pressed={current === value}
          onClick={() => onSelect(value)}
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}

function ManageListBody({
  list,
  empty,
  renderRow,
}: Readonly<{
  list: ReturnType<typeof useManagePosts>;
  empty: string;
  renderRow: (row: ManagePostItem) => ReactNode;
}>) {
  let body: ReactNode = null;
  if (list.items.length > 0) {
    body = <ul className="manage-list">{list.items.map(renderRow)}</ul>;
  } else if (!list.loading && !list.error) {
    body = <p className="manage-empty">{empty}</p>;
  }
  return (
    <>
      {body}
      {list.loading ? <p aria-busy="true">불러오는 중…</p> : null}
      {list.nextCursor && !list.loading ? (
        <button type="button" className="btn manage-more" onClick={() => void list.loadMore()}>
          더 보기
        </button>
      ) : null}
    </>
  );
}
