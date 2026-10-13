import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigationType, useParams, useSearchParams } from 'react-router-dom';
import { getBlogCategories, type BlogCategories } from '../api/categories';
import { ApiError } from '../api/client';
import { getBlogHeader, listBlogPosts } from '../api/members';
import { getBlogTags } from '../api/tags';
import type { FriendshipStatus } from '../api/friends';
import type { BlogHeader } from '../api/types/reading';
import type { BlogTags } from '../api/types/tags';
import BlogTagStrip from '../components/BlogTagStrip';
import DefaultAvatar from '../components/DefaultAvatar';
import FriendButton from '../components/FriendButton';
import LoadMoreButton, { INITIAL_LOAD_FAILED_TEXT } from '../components/LoadMoreButton';
import PostCard from '../components/PostCard';
import PostCardGrid from '../components/PostCardGrid';
import BlogCategoryNav from '../features/category/BlogCategoryNav';
import { findBlogCategory } from '../features/category/categoryTree';
import { MY_FRIENDS_PATH } from '../features/friends/friendMessages';
import { useNarrowScreen } from '../features/category/useNarrowScreen';
import { useCursorList } from '../features/post-list/useCursorList';
import PostSearchResults from '../features/search/PostSearchResults';
import SearchBox from '../features/search/SearchBox';
import { BLOG_SEARCH_BOX_LABEL } from '../features/search/searchMessages';
import type { SearchSort } from '../api/types/discovery';
import NotFoundPage from './NotFoundPage';
import '../features/friends/friends.css';

/** 글이 없을 때 (FR-023). */
export const EMPTY_BLOG_TEXT = '아직 공개한 글이 없어요';
export const EMPTY_MY_BLOG_TEXT = '첫 글을 써 보세요';
/** 태그 필터 결과가 없을 때 (008) */
export const EMPTY_TAG_FILTER_TEXT = '이 태그로 공개한 글이 없어요';
/** 카테고리 필터 결과가 없을 때 (017) */
export const EMPTY_CATEGORY_TEXT = '이 카테고리에는 아직 공개된 글이 없어요';

type HeaderStatus = 'loading' | 'ready' | 'not-found' | 'error';

interface HeaderState {
  status: HeaderStatus;
  header: BlogHeader | null;
}

const LOADING: HeaderState = { status: 'loading', header: null };

/**
 * 개인 블로그 화면 (005 T051, US3, FR-019~023).
 *
 * 머리말과 글 목록을 동시에 부르고, 카드는 홈과 같은 부품을 작성자 영역만 빼고 쓴다(`showAuthor=false`).
 * 첫 목록 실패 문구와 뒤로 가기 복원(`blog:{handle}`)은 홈과 같다(005 T071).
 *
 * (구현 메모) 라우트는 `/:handle`이고 `@`는 화면이 떼어 낸다 — react-router 7은 한 구간의 일부만 파라미터로 받지 못한다.
 * 008: 머리말 아래 태그 줄(`BlogTagStrip`, 실패하면 줄 없이 계속)과 `?tag=` 필터. 필터 중이면 "#jpa 글 5개 [필터 해제]"
 * (태그 줄 밖 태그면 수 없이 "#이름 [필터 해제]")를 보이고 `listBlogPosts(handle, cursor, tag)`로 부르며 복원 키는
 * `blog:{handle}:tag:{tag}`다. 정규화되지 않은 `?tag=`는 서버 첫 응답이 이미 301·404로 처리했다.
 *
 * 친구: 머리말의 수 줄은 "공개 글 N · 친구 N"이다(내 블로그면 친구 수가 친구 화면의 내 친구 탭 `/friends?tab=friends` 링크). 아래에
 * `FriendButton`(내 블로그면 없음)을 두고, 수락·끊기로 친구 상태가 되거나 풀리면 친구 수를 화면에서 바로 ±1 한다.
 *
 * 017: 카테고리 목록(`BlogCategoryNav`, 데스크톱은 오른쪽 칸·768px 미만은 목록 위 접힌 버튼, 실패하면 목록 없이 계속)과
 * `?category=` 필터. 필터 중이면 "이름 · 글 N개 [전체 보기]"를 보이고 `listBlogPosts(handle, cursor, null, category)`로
 * 부르며 복원 키는 `blog:{handle}:category:{id}`다. 카테고리 필터가 있으면 태그 필터는 쓰지 않는다. 이 블로그의 카테고리가
 * 아닌 값은 서버 첫 응답이 404 화면으로 처리했다.
 *
 * 012: 목록 위에 "이 블로그에서 검색" 입력. `?q=`가 있으면 목록 자리에 이 블로그 안 검색 결과(같은 카드·정렬 탭,
 * `?sort=latest`)를 보이고 글 목록은 부르지 않는다(요청 없는 빈 목록). 서버 셸은 `q`가 있으면 `noindex`다.
 *
 * 001 `LastActiveBadge`(T142)와 시리즈 탭은 아직 없어 `headerSlot`·`sidebarSlot` prop 자리만 둔다.
 */
export interface BlogPageProps {
  /** 001 마지막 활동 배지 자리 (001 US8) */
  headerSlot?: ReactNode;
  /** 개인 확장(카테고리 사이드바·시리즈 탭) 자리 (spec Assumptions) */
  sidebarSlot?: ReactNode;
}

export default function BlogPage({ headerSlot = null, sidebarSlot = null }: BlogPageProps) {
  const params = useParams();
  const rawHandle = params.handle ?? '';
  const blogAddress = rawHandle.startsWith('@');
  const handle = blogAddress ? rawHandle.slice(1) : '';

  const [state, setState] = useState<HeaderState>(LOADING);
  /** 친구 버튼으로 바뀐 친구 수 (머리말 값에 더할 차이, 어느 블로그의 값인지 함께 둔다) */
  const [friendDelta, setFriendDelta] = useState<{ handle: string; delta: number } | null>(null);
  const onFriendshipChange = useCallback(
    (status: FriendshipStatus, previous: FriendshipStatus) => {
      const step = status === 'FRIENDS' ? 1 : previous === 'FRIENDS' ? -1 : 0;
      if (step !== 0) {
        setFriendDelta((current) => ({
          handle,
          delta: (current !== null && current.handle === handle ? current.delta : 0) + step,
        }));
      }
    },
    [handle],
  );
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q');
  const searching = q !== null && q.trim() !== '';
  const sort: SearchSort = searchParams.get('sort') === 'latest' ? 'latest' : 'relevance';
  const category = searchParams.get('category');
  const tag = category === null ? searchParams.get('tag') : null;
  const narrow = useNarrowScreen();
  /** 카테고리 목록 (어느 블로그의 결과인지 함께 둔다) */
  const [categoryList, setCategoryList] = useState<{
    handle: string;
    data: BlogCategories;
  } | null>(null);

  useEffect(() => {
    if (!blogAddress) {
      return undefined;
    }
    let cancelled = false;
    getBlogCategories(handle).then(
      (data) => {
        if (!cancelled) {
          setCategoryList({ handle, data });
        }
      },
      () => {
        // 카테고리 목록을 못 불러와도 블로그는 그대로 보인다 (원칙 V)
      },
    );
    return () => {
      cancelled = true;
    };
  }, [handle, blogAddress]);
  /** 태그 줄 (어느 블로그의 결과인지 함께 둔다) */
  const [strip, setStrip] = useState<{ handle: string; tags: BlogTags } | null>(null);

  useEffect(() => {
    if (!blogAddress) {
      return undefined;
    }
    let cancelled = false;
    getBlogTags(handle).then(
      (tags) => {
        if (!cancelled) {
          setStrip({ handle, tags });
        }
      },
      () => {
        // 태그 줄을 못 불러와도 블로그는 그대로 보인다
      },
    );
    return () => {
      cancelled = true;
    };
  }, [handle, blogAddress]);

  useEffect(() => {
    if (!blogAddress) {
      return undefined;
    }
    let cancelled = false;
    void (async () => {
      try {
        const header = await getBlogHeader(handle);
        if (!cancelled) {
          setState({ status: 'ready', header });
          // 새로 읽은 친구 수에는 앞서 누른 결과가 이미 들어 있다
          setFriendDelta(null);
        }
      } catch (error) {
        if (!cancelled) {
          const notFound = error instanceof ApiError && error.status === 404;
          setState({ status: notFound ? 'not-found' : 'error', header: null });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handle, blogAddress]);

  const navigationType = useNavigationType();
  const load = useCallback(
    (cursor?: string | null) =>
      searching
        ? Promise.resolve({ items: [], nextCursor: null })
        : listBlogPosts(handle, cursor, tag, category),
    [handle, tag, category, searching],
  );
  // 뒤로 가기로 돌아오면 30분 안의 보관값으로 복원한다 (005 T071, FR-018)
  const list = useCursorList(load, {
    listKey: searching
      ? undefined
      : category !== null
        ? `blog:${handle}:category:${category}`
        : tag === null
          ? `blog:${handle}`
          : `blog:${handle}:tag:${tag}`,
    restore: navigationType === 'POP',
  });

  if (!blogAddress || state.status === 'not-found') {
    return <NotFoundPage />;
  }
  const header = state.header;
  const friendCountText =
    header === null
      ? ''
      : Math.max(
          0,
          header.friendCount +
            (friendDelta !== null && friendDelta.handle === handle ? friendDelta.delta : 0),
        ).toLocaleString('ko-KR');
  const stripTags = strip !== null && strip.handle === handle ? strip.tags : null;
  const activeCount =
    tag === null ? undefined : stripTags?.items.find((item) => item.name === tag)?.postCount;
  const categories =
    categoryList !== null && categoryList.handle === handle ? categoryList.data : null;
  const activeCategoryId = category !== null && /^\d+$/.test(category) ? Number(category) : null;
  const activeCategory =
    categories !== null && activeCategoryId !== null
      ? findBlogCategory(categories, activeCategoryId)
      : null;
  const hasCategories = categories !== null && categories.items.length > 0;

  return (
    <main
      data-route="blog"
      style={{
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: 'var(--page-max-width, 72rem)',
        margin: '0 auto',
        padding: '1.5rem 1rem',
      }}
    >
      {header === null ? (
        <div aria-busy="true" style={{ minHeight: '4rem' }} />
      ) : (
        <header
          style={{
            display: 'flex',
            gap: '1rem',
            alignItems: 'flex-start',
            margin: '0 0 1.5rem',
          }}
        >
          {header.profileImageUrl ? (
            <img
              src={header.profileImageUrl}
              data-testid="blog-avatar"
              alt=""
              width={64}
              height={64}
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                objectFit: 'cover',
                flex: '0 0 64px',
              }}
            />
          ) : (
            <DefaultAvatar nickname={header.nickname} handle={header.handle} size={64} />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '1.25rem', margin: 0 }}>{header.nickname}</h1>
            <p style={{ margin: '0.125rem 0 0', color: 'var(--color-text-muted)' }}>
              @{header.handle}
            </p>
            {header.bio ? (
              <p
                data-testid="blog-bio"
                style={{ whiteSpace: 'pre-line', margin: '0.5rem 0 0', overflowWrap: 'anywhere' }}
              >
                {header.bio}
              </p>
            ) : null}
            <p className="friend-counts" data-testid="blog-counts">
              <span>공개 글 {header.publicPostCount.toLocaleString('ko-KR')}</span>
              <span aria-hidden="true">·</span>
              {header.isMe ? (
                <Link to={MY_FRIENDS_PATH}>친구 {friendCountText}</Link>
              ) : (
                <span>친구 {friendCountText}</span>
              )}
            </p>
            {header.isMe ? null : (
              <div style={{ margin: '0.5rem 0 0' }}>
                <FriendButton
                  key={header.handle}
                  handle={header.handle}
                  onChange={onFriendshipChange}
                />
              </div>
            )}
            {headerSlot}
          </div>
        </header>
      )}

      <div className={hasCategories ? 'blog-layout blog-layout--with-nav' : 'blog-layout'}>
        <div className="blog-layout__main">
          <SearchBox
            key={`search:${handle}:${q ?? ''}`}
            label={BLOG_SEARCH_BOX_LABEL}
            placeholder={BLOG_SEARCH_BOX_LABEL}
            defaultValue={q ?? ''}
            className="search-page-form"
            onSearch={(next) => setSearchParams({ q: next })}
          />

          {stripTags !== null && category === null ? (
            <BlogTagStrip
              handle={handle}
              items={stripTags.items}
              initialVisible={stripTags.initialVisible}
              active={tag}
            />
          ) : null}

          {tag !== null ? (
            <div role="status" aria-label="태그 필터" className="tag-filter-header">
              <strong style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                #{tag}
                {activeCount !== undefined ? ` 글 ${activeCount.toLocaleString('ko-KR')}개` : ''}
              </strong>
              <Link to={`/@${handle}`}>필터 해제</Link>
            </div>
          ) : null}

          {category !== null ? (
            <div role="status" aria-label="카테고리 필터" className="category-filter-header">
              <strong style={{ overflowWrap: 'anywhere', minWidth: 0 }}>
                {activeCategory?.name ?? '카테고리'}
                {activeCategory
                  ? ` · 글 ${activeCategory.postCount.toLocaleString('ko-KR')}개`
                  : ''}
              </strong>
              <Link to={`/@${handle}`}>전체 보기</Link>
            </div>
          ) : null}

          {!hasCategories && categories !== null && header?.isMe ? (
            <p className="blog-category-nav__manage">
              <Link to="/manage/categories">카테고리 만들기</Link>
            </p>
          ) : null}

          {sidebarSlot}

          {searching ? (
            <section aria-label="이 블로그 검색 결과">
              <p role="status" className="tag-filter-header">
                <strong style={{ overflowWrap: 'anywhere', minWidth: 0 }}>'{q}' 검색 결과</strong>
                <Link to={`/@${handle}`}>검색 해제</Link>
              </p>
              <PostSearchResults
                q={q}
                sort={sort}
                blog={handle}
                showAuthor={false}
                onSortChange={(next) =>
                  setSearchParams(next === 'latest' ? { q, sort: next } : { q })
                }
              />
            </section>
          ) : null}

          {searching ? null : (
            <>
              <PostCardGrid>
                {list.items.map((card) => (
                  <PostCard key={card.id} card={card} showAuthor={false} />
                ))}
              </PostCardGrid>

              {list.initialError ? (
                <p role="status" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  {INITIAL_LOAD_FAILED_TEXT}{' '}
                  <button type="button" onClick={() => void list.retry()}>
                    다시 시도
                  </button>
                </p>
              ) : list.loadedOnce && list.items.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                  {category !== null ? (
                    <p style={{ margin: 0 }}>{EMPTY_CATEGORY_TEXT}</p>
                  ) : tag !== null ? (
                    <p style={{ margin: 0 }}>{EMPTY_TAG_FILTER_TEXT}</p>
                  ) : header?.isMe ? (
                    <p style={{ margin: 0 }}>
                      {EMPTY_MY_BLOG_TEXT} <Link to="/write/new">글쓰기</Link>
                    </p>
                  ) : (
                    <p style={{ margin: 0 }}>{EMPTY_BLOG_TEXT}</p>
                  )}
                </div>
              ) : (
                <LoadMoreButton
                  status={list.status}
                  done={list.done}
                  onLoadMore={() => void list.loadMore()}
                  onRetry={() => void list.retry()}
                />
              )}
            </>
          )}
        </div>
        {hasCategories ? (
          <aside>
            <BlogCategoryNav
              handle={handle}
              categories={categories}
              active={activeCategoryId}
              collapsed={narrow}
            />
            {header?.isMe ? (
              <Link to="/manage/categories" className="blog-category-nav__manage">
                카테고리 관리
              </Link>
            ) : null}
          </aside>
        ) : null}
      </div>
    </main>
  );
}
