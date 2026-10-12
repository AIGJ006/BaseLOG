import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTrendingTags } from '../api/tags';
import type { TagCount } from '../api/types/tags';
import { tagPath } from '../features/tag/tagPath';
import './homeSidebar.css';

/**
 * 홈 오른쪽 칸 (화면 다듬기, 2026-10-12 민서 요청 "넓은 화면에서 우측에 뭔가 하나 더"). 넓은 화면에서는 목록 오른쪽에,
 * 좁은 화면에서는 목록 아래에 놓인다. 요즘 인기 태그(`GET /api/tags/trending` — 최근 7일 공개 글 수 순 15개, 없으면 전체 순위)를 보인다.
 * BaseLOG 소개·[글 쓰러 가기] 칸은 2026-10-12 민서 요청("없어도 될 거 같아")으로 뺐다.
 * 인기 글은 [트렌딩] 탭이 따로 있고 최신 탭에서 트렌딩을 부르지 않는 규칙(012)이 있어 넣지 않는다. 태그는 덤이라 못 불러오면 감춘다.
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

  return (
    <aside className="home-sidebar" aria-label="둘러보기">
      {tags && tags.length > 0 ? (
        <section className="home-sidebar-box">
          <h2>요즘 인기 태그</h2>
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
    </aside>
  );
}
