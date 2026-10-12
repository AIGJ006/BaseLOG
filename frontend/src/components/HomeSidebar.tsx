import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTopTags } from '../api/tags';
import type { TagCount } from '../api/types/tags';
import { tagPath } from '../features/tag/tagPath';
import './homeSidebar.css';

/** 오른쪽 칸에 보이는 태그 수 */
const TAG_LIMIT = 15;

/**
 * 홈 오른쪽 칸 (화면 다듬기, 2026-10-12 민서 요청 "넓은 화면에서 우측에 뭔가 하나 더"). 넓은 화면에서는 목록 오른쪽에,
 * 좁은 화면에서는 목록 아래에 놓인다. 많이 쓰인 태그(008 태그 목록 위 15개)와 BaseLOG 소개·[글 쓰러 가기]를 보인다.
 * 인기 글은 [트렌딩] 탭이 따로 있고 최신 탭에서 트렌딩을 부르지 않는 규칙(012)이 있어 넣지 않는다. 태그는 덤이라 못 불러오면 감춘다.
 */
export default function HomeSidebar() {
  const [tags, setTags] = useState<TagCount[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    listTopTags().then(
      (index) => !cancelled && setTags(index.items.slice(0, TAG_LIMIT)),
      () => !cancelled && setTags([]),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <aside className="home-sidebar" aria-label="둘러보기">
      {tags && tags.length > 0 ? (
        <section className="home-sidebar-box">
          <h2>태그</h2>
          <ul className="home-sidebar-tags">
            {tags.map((tag) => (
              <li key={tag.name}>
                <Link to={tagPath(tag.name)}>
                  #{tag.name}
                  <span className="visually-hidden"> 글 {tag.postCount}개</span>
                </Link>
              </li>
            ))}
          </ul>
          <Link className="home-sidebar-more" to="/tags">
            태그 전체 보기
          </Link>
        </section>
      ) : null}
      <section className="home-sidebar-box home-sidebar-about">
        <h2>
          <span className="home-sidebar-brand">B</span>ase
          <span className="home-sidebar-brand">LOG</span>
        </h2>
        <p>생각을 기록하고 나누는 블로그예요. 오늘 배운 것을 한 줄이라도 남겨 보세요.</p>
        <Link className="btn btn-primary" to="/write/new">
          글 쓰러 가기
        </Link>
      </section>
    </aside>
  );
}
