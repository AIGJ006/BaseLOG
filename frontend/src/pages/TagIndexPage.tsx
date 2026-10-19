import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listTopTags } from '../api/tags';
import type { TagCount } from '../api/types/tags';
import TagPosts from '../features/tag/TagPosts';
import { tagPath } from '../features/tag/tagPath';
import NotFoundPage from './NotFoundPage';
import '../features/tag/tag.css';

export const EMPTY_TAG_INDEX_TEXT = '아직 태그가 없어요';
export const TAG_INDEX_FAILED_TEXT = '불러오지 못했어요';

type State = { status: 'loading' } | { status: 'ready'; items: TagCount[] } | { status: 'error' };

/**
 * 전체 태그 목록 화면 (008 T052, US4). 공개 글 수 많은 순 상위 100개를 `#이름 글 수` 링크로 줄바꿈해 보인다(375px에서도 가로
 * 스크롤 없음 — 긴 이름은 `overflow-wrap: anywhere`).
 *
 * 태그를 누르면(2026-10-19) 화면을 옮기지 않고 목록 아래에 그 태그 글을 펼친다. 주소는 예전 태그 페이지와 같은 `/tags/:name`
 * 이라 새로고침·공유·글의 태그 링크가 그대로 이 화면으로 온다. 펼친 태그를 다시 누르면 `/tags`로 접는다. 두 주소가 같은 화면이라
 * 태그 사이를 오가도 위 목록은 다시 부르지 않는다. react-router는 `:name`을 디코드해서 준다(`/tags/c%23` → `c#`).
 */
export default function TagIndexPage() {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const selected = useParams().name ?? null;
  const [notFound, setNotFound] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTopTags().then(
      (index) => {
        if (!cancelled) {
          setState({ status: 'ready', items: index.items });
        }
      },
      () => {
        if (!cancelled) {
          setState({ status: 'error' });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  if (selected !== null && notFound === selected) {
    return <NotFoundPage />;
  }

  return (
    <main data-route="tag-index" className="tag-page">
      <header className="tag-page__header">
        <h1 className="tag-page__title">태그</h1>
      </header>
      {state.status === 'loading' ? (
        <div aria-busy="true" style={{ minHeight: '4rem' }} />
      ) : state.status === 'error' ? (
        <p role="status" className="tag-page__empty">
          {TAG_INDEX_FAILED_TEXT}{' '}
          <button type="button" onClick={retry}>
            다시 시도
          </button>
        </p>
      ) : state.items.length === 0 ? (
        <p className="tag-page__empty">{EMPTY_TAG_INDEX_TEXT}</p>
      ) : (
        <ul className="tag-index__list" aria-label="태그 목록">
          {state.items.map((tag) => (
            <li key={tag.name} style={{ minWidth: 0, maxWidth: '100%' }}>
              <Link
                className="tag-link"
                to={tag.name === selected ? '/tags' : tagPath(tag.name)}
                aria-current={tag.name === selected ? 'true' : undefined}
              >
                #{tag.name}{' '}
                <span className="tag-index__count">{tag.postCount.toLocaleString('ko-KR')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {selected !== null ? (
        <TagPosts key={selected} name={selected} onNotFound={setNotFound} />
      ) : null}
    </main>
  );
}
