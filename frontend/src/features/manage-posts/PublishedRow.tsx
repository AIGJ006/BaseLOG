import { Link } from 'react-router-dom';
import type { ManagePostItem } from '../../api/managePosts';
import VisibilityBadge from '../visibility/VisibilityBadge';
import RowError from './RowError';
import { formatPublished } from './format';

export interface PublishedRowProps {
  row: ManagePostItem;
  /** 내 블로그 주소의 handle (상세 링크 `/@{handle}/posts/{id}`) */
  handle: string | null;
  busy: boolean;
  error: string | undefined;
  onTrash: (row: ManagePostItem) => void;
  onDiscard: (row: ManagePostItem) => void;
  /** 028 [고정]·[고정 해제] */
  onTogglePin: (row: ManagePostItem) => void;
}

/**
 * 발행 글 줄 (006 T049·T069, FR-008·010·016): 공개 범위 표시, [수정 중]·숨김 배지, "발행 … · 수정됨 …", 반응 숫자,
 * 제목 링크(글로)·[이어서 수정](고치는 중일 때만)·[변경 취소]·[삭제]. 공개 범위를 바꿔도 "수정됨"은 생기지 않는다(서버 `editedAt` 그대로).
 *
 * 028: 고정 글이면 제목 앞에 "📌 고정" 배지, 줄 끝 [고정]·[고정 해제]로 둥지 맨 위 고정을 바꾼다(최대 3개 — 넘으면 서버 문구를 줄 아래에).
 *
 * 공개 범위는 표시만 한다 — 줄의 [공개 범위 ▾]는 2026-10-12 민서 요청으로 뺐다(바꾸기는 글 화면에서).
 */
export default function PublishedRow({
  row,
  handle,
  busy,
  error,
  onTrash,
  onDiscard,
  onTogglePin,
}: PublishedRowProps) {
  return (
    <li className="manage-row" data-post-id={row.id}>
      <div className="manage-row-main">
        <span className="manage-title-line">
          <VisibilityBadge visibility={row.visibility} compact />
          {row.pinned ? (
            <span className="manage-badge manage-badge-pinned">
              <span aria-hidden="true">📌</span> 고정
            </span>
          ) : null}
          {handle ? (
            <Link className="manage-title" to={`/@${handle}/posts/${row.id}`}>
              {row.title}
            </Link>
          ) : (
            <span className="manage-title">{row.title}</span>
          )}
          {row.editing ? <span className="manage-badge">수정 중</span> : null}
          {row.hidden ? (
            <span className="manage-badge manage-badge-hidden">운영 정책에 따라 숨겨짐</span>
          ) : null}
        </span>
        <span className="manage-meta">{formatPublished(row.publishedAt, row.editedAt)}</span>
        <span className="manage-meta">
          조회 {row.viewCount.toLocaleString('ko-KR')} · 좋아요{' '}
          {row.likeCount.toLocaleString('ko-KR')} · 댓글 {row.commentCount.toLocaleString('ko-KR')}
        </span>
      </div>
      <div className="manage-row-actions">
        {/* [보기]·[수정]은 2026-10-12 민서 요청으로 뺐다 — 제목이 글로 가고, 수정은 글 화면의 [수정]에서. 고치다 만 글만 [이어서 수정] */}
        {row.editing ? <Link to={`/write/${row.id}`}>이어서 수정</Link> : null}
        {row.editing ? (
          <button type="button" disabled={busy} onClick={() => onDiscard(row)}>
            변경 취소
          </button>
        ) : null}
        <button
          type="button"
          disabled={busy}
          aria-pressed={row.pinned}
          onClick={() => onTogglePin(row)}
        >
          {row.pinned ? '고정 해제' : '고정'}
        </button>
        <button type="button" disabled={busy} onClick={() => onTrash(row)}>
          삭제
        </button>
      </div>
      <RowError message={error} />
    </li>
  );
}
