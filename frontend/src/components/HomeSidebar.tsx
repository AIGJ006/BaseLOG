import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTagPosts, listTrendingTags } from '../api/tags';
import type { PostCard } from '../api/types/reading';
import type { TagCount } from '../api/types/tags';
import { tagPath } from '../features/tag/tagPath';
import './homeSidebar.css';

/** 태그 줄은 이만큼만 보인다(넘치는 태그는 [태그 전체 보기]에서) */
const TAG_ROWS = 3;
/** 인기 태그 칸에 띄우는 그 태그 글 수 */
const SPOTLIGHT_POSTS = 3;

/**
 * 홈 오른쪽 칸 (화면 다듬기, 2026-10-12 민서 요청 "넓은 화면에서 우측에 뭔가 하나 더"). 넓은 화면에서는 목록 오른쪽에,
 * 좁은 화면에서는 목록 아래에 놓인다. 요즘 인기 태그(`GET /api/tags/trending` — 최근 7일 공개 글 수 순 15개, 없으면 전체 순위)를 보인다.
 * BaseLOG 소개·[글 쓰러 가기] 칸은 2026-10-12 민서 요청("없어도 될 거 같아")으로 뺐다.
 * 인기 글은 [트렌딩] 탭이 따로 있고 최신 탭에서 트렌딩을 부르지 않는 규칙(012)이 있어 넣지 않는다. 태그는 덤이라 못 불러오면 감춘다.
 *
 * 2026-10-12 민서 요청: 태그는 세 줄까지만 두고, 그 아래에 1위 태그를 제목처럼 크게 놓고 그 태그 글 3개를 보인다.
 * 글 목록 양옆(가운데 줄 높이)의 ‹ ›로 다른 인기 태그의 글로 넘긴다(끝에서 처음으로 돈다).
 */
export default function HomeSidebar() {
  const [tags, setTags] = useState<TagCount[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTrendingTags().then(
      (index) => !cancelled && setTags(index.items),
      () => !cancelled && setTags([]),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (!tags || tags.length === 0) {
    return <aside className="home-sidebar" aria-label="둘러보기" />;
  }

  return (
    <aside className="home-sidebar" aria-label="둘러보기">
      <section className="home-sidebar-box">
        <h2>요즘 인기 태그</h2>
        <TagRows tags={tags} />
        <TagSpotlight tags={tags} />
        <Link className="home-sidebar-more" to="/tags">
          태그 전체 보기
        </Link>
      </section>
    </aside>
  );
}

/** 태그 알약을 세 줄까지만 보인다. 줄 수는 칸 너비에 따라 달라지므로 그려진 위치로 센다. */
function TagRows({ tags }: { tags: TagCount[] }) {
  const listRef = useRef<HTMLUListElement>(null);

  const clip = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.children) as HTMLElement[];
    items.forEach((item) => (item.hidden = false));
    const rows: number[] = [];
    for (const item of items) {
      const top = item.offsetTop;
      if (!rows.includes(top)) rows.push(top);
      item.hidden = rows.indexOf(top) >= TAG_ROWS;
    }
  }, []);

  useLayoutEffect(() => {
    clip();
    const list = listRef.current;
    if (!list || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(clip);
    observer.observe(list);
    return () => observer.disconnect();
  }, [clip, tags]);

  return (
    <ul ref={listRef} className="home-sidebar-tags">
      {tags.map((tag) => (
        <li key={tag.name}>
          <Link to={tagPath(tag.name)}>
            #{tag.name}
            <span className="visually-hidden"> 글 {tag.postCount}개</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** 인기 태그 하나를 크게 + 그 태그 글 3개. ‹ ›로 다음·이전 태그. */
function TagSpotlight({ tags }: { tags: TagCount[] }) {
  const [index, setIndex] = useState(0);
  const [posts, setPosts] = useState<Record<string, PostCard[] | 'error'>>({});
  const tag = tags[index % tags.length];
  const shown = posts[tag.name];

  useEffect(() => {
    if (posts[tag.name] !== undefined) return;
    let cancelled = false;
    listTagPosts(tag.name, null, { notFoundScreen: false }).then(
      (page) =>
        !cancelled &&
        setPosts((all) => ({ ...all, [tag.name]: page.items.slice(0, SPOTLIGHT_POSTS) })),
      () => !cancelled && setPosts((all) => ({ ...all, [tag.name]: 'error' })),
    );
    return () => {
      cancelled = true;
    };
  }, [tag.name, posts]);

  const move = (step: number) => setIndex((i) => (i + step + tags.length) % tags.length);

  return (
    <div className="home-sidebar-spotlight">
      <h3 className="home-sidebar-spotlight-title">
        <Link to={tagPath(tag.name)}>#{tag.name}</Link>
      </h3>
      <div className="home-sidebar-spotlight-body">
        {tags.length > 1 ? (
          <button
            type="button"
            className="home-sidebar-spotlight-arrow"
            aria-label="이전 태그"
            onClick={() => move(-1)}
          >
            ‹
          </button>
        ) : null}
        {shown === undefined ? (
          <p className="home-sidebar-spotlight-note" aria-busy="true">
            불러오는 중…
          </p>
        ) : shown === 'error' ? (
          <p className="home-sidebar-spotlight-note">글을 불러오지 못했어요</p>
        ) : shown.length === 0 ? (
          <p className="home-sidebar-spotlight-note">아직 글이 없어요</p>
        ) : (
          <ul className="home-sidebar-spotlight-posts" aria-live="polite">
            {shown.map((post) => (
              <li key={post.id}>
                <Link to={post.url}>{post.title}</Link>
                <span>{post.author.nickname}</span>
              </li>
            ))}
          </ul>
        )}
        {tags.length > 1 ? (
          <button
            type="button"
            className="home-sidebar-spotlight-arrow"
            aria-label="다음 태그"
            onClick={() => move(1)}
          >
            ›
          </button>
        ) : null}
      </div>
    </div>
  );
}
