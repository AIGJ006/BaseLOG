import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PostDetailAuthor } from '../api/types/reading';
import DefaultAvatar from './DefaultAvatar';

/**
 * 본문 아래 작성자 카드 (005 T039, FR-034). 프로필 사진(없으면 기본 아이콘)·닉네임·`@handle`·소개(글자만,
 * 줄바꿈 유지)·친구 버튼 자리를 둔다. 사진·이름을 누르면 블로그로 간다([블로그 가기]는 2026-10-12 민서 요청으로 뺐다). 내 글이면 친구 버튼 자리를 비운다.
 *
 * 친구 버튼은 `friendButton`으로 받는다 — 글 상세가 `components/FriendButton`을 넣는다(비회원이 누르면 로그인 화면으로).
 */
export interface AuthorCardProps {
  author: PostDetailAuthor;
  /** 내 글인가 — true면 친구 버튼 자리를 만들지 않는다 */
  isMe: boolean;
  friendButton?: ReactNode;
  /** 021 둥지 새 배지 (이름 옆 작은 새 아이콘·크기) — 글 상세가 넣는다 */
  nestBadge?: ReactNode;
}

export default function AuthorCard({
  author,
  isMe,
  friendButton = null,
  nestBadge = null,
}: AuthorCardProps) {
  const blogPath = `/@${author.handle}`;
  return (
    <aside
      data-testid="author-card"
      style={{
        display: 'flex',
        gap: '0.75rem',
        alignItems: 'flex-start',
        margin: '2rem 0 0',
        padding: '1rem',
        borderRadius: '0.5rem',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
      }}
    >
      {/* 사진은 이름 링크와 같은 곳으로 가므로 화면 읽기·탭 순서에서는 한 번만 */}
      <Link to={blogPath} tabIndex={-1} aria-hidden="true" style={{ flex: '0 0 48px' }}>
        {author.profileImageUrl ? (
          <img
            src={author.profileImageUrl}
            data-testid="author-card-avatar"
            alt=""
            width={48}
            height={48}
            loading="lazy"
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              objectFit: 'cover',
              flex: '0 0 48px',
            }}
          />
        ) : (
          <DefaultAvatar nickname={author.nickname} handle={author.handle} size={48} />
        )}
      </Link>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>
          <Link to={blogPath} style={{ color: 'var(--color-text)' }}>
            {author.nickname}{' '}
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
              @{author.handle}
            </span>
          </Link>
          {nestBadge}
        </p>
        {author.bio ? (
          <p
            data-testid="author-bio"
            style={{ whiteSpace: 'pre-line', margin: '0.5rem 0 0', overflowWrap: 'anywhere' }}
          >
            {author.bio}
          </p>
        ) : null}
        {isMe || !friendButton ? null : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.5rem',
              margin: '0.75rem 0 0',
            }}
          >
            {friendButton}
          </div>
        )}
      </div>
    </aside>
  );
}
