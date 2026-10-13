import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PostCard as PostCardData } from '../api/types/reading';
import AuthorChip from './AuthorChip';
import NestB from './NestB';
import RelativeTime from './RelativeTime';
import { VISIBILITY_OPTIONS } from '../features/visibility/visibilityOptions';
import './postCard.css';

/**
 * 글 카드 (005 FR-007~015, 10 §2). 정보 구성은 공통이고 색·글꼴·비율은 CSS 변수로 둔다(research R-09).
 * 친구 공개 글은 썸네일 왼쪽 위에 "👥 친구 공개" 표시를 단다(2026-10-13).
 * 제목·요약은 React 텍스트 노드로 넣어 HTML로 해석되지 않는다(원칙 IV).
 */
export interface PostCardProps {
  card: PostCardData;
  /** 홈은 true, 개인 블로그는 false (작성자 영역 생략) */
  showAuthor?: boolean;
  /** 요약 자리에 대신 그릴 내용 (012 검색 결과의 주변 문장 `SnippetText`). 없으면 `excerpt` */
  preview?: ReactNode;
}

const CLAMP = {
  display: '-webkit-box',
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
};

export default function PostCard({ card, showAuthor = true, preview }: PostCardProps) {
  return (
    <article
      data-testid="post-card"
      className="post-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        boxSizing: 'border-box',
        minWidth: 0,
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--card-radius, 0.875rem)',
        background: 'var(--color-surface)',
        overflow: 'hidden',
      }}
    >
      <Link
        to={card.url}
        className="post-card-link"
        style={{ color: 'inherit', textDecoration: 'none', display: 'block', minWidth: 0 }}
      >
        <span
          data-testid="card-thumb"
          data-empty={card.thumbnailUrl === null ? 'true' : 'false'}
          className="post-card-thumb"
          style={{
            display: 'block',
            width: '100%',
            aspectRatio: 'var(--card-thumb-ratio, 16 / 9)',
            background: 'var(--thumb-empty)',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {card.visibility === 'FRIENDS' && (
            <span data-testid="card-friends-badge" className="post-card-badge">
              <span aria-hidden="true">{VISIBILITY_OPTIONS.FRIENDS.icon}</span>{' '}
              {VISIBILITY_OPTIONS.FRIENDS.label}
            </span>
          )}
          {card.thumbnailUrl ? (
            <img
              src={card.thumbnailUrl}
              alt={card.title}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            // 019: 썸네일을 고르지 않은 글은 로고의 둥지 B
            <NestB />
          )}
        </span>
        <h3
          data-testid="card-title"
          title={card.title}
          style={{
            ...CLAMP,
            WebkitLineClamp: 1,
            margin: '1rem 1rem 0.375rem',
            fontSize: 'var(--card-title-size, 1.0625rem)',
            fontWeight: 700,
            lineHeight: 1.4,
          }}
        >
          {card.title}
        </h3>
        <p
          data-testid="card-excerpt"
          style={{
            ...CLAMP,
            WebkitLineClamp: 3,
            minHeight: 'calc(1.5em * 3)',
            margin: '0 1rem 0.75rem',
            fontSize: 'var(--card-excerpt-size, 0.875rem)',
            lineHeight: 1.5,
            color: 'var(--color-text-muted)',
          }}
        >
          {preview ?? card.excerpt ?? ''}
        </p>
      </Link>
      <div
        style={{
          marginTop: 'auto',
          padding: '0.625rem 1rem 0.75rem',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
          fontSize: 'var(--card-meta-size, 0.8125rem)',
          color: 'var(--color-text-muted)',
          minWidth: 0,
        }}
      >
        {showAuthor ? <AuthorChip author={card.author} /> : null}
        <RelativeTime value={card.firstPublicAt} />
        <span data-testid="card-comments" title="댓글 수" style={{ marginLeft: 'auto' }}>
          💬 {card.commentCount}
        </span>
        <span data-testid="card-likes" title="좋아요 수">
          ♥ {card.likeCount}
        </span>
      </div>
    </article>
  );
}
