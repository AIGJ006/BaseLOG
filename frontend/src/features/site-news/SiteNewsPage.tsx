import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { Note } from './parseNote';
import './siteNews.css';

type Props = {
  title: string;
  intro: string;
  notes: Note[];
  /** 글 위 작은 꼬리표 (업데이트 소식은 버전 "v1.0.1") */
  showId?: boolean;
};

function formatDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일` : date;
}

/**
 * 공지(`/notices`)·업데이트 소식(`/releases`) 화면. 글 목록은 빌드에 들어간 파일(README.md)이고, 최신 글이 위.
 * 주소 끝 `#v1.0.1`이면 그 글로 내려간다.
 */
export default function SiteNewsPage({ title, intro, notes, showId = false }: Props) {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      document.getElementById(decodeURIComponent(hash.slice(1)))?.scrollIntoView();
    }
  }, [hash]);

  return (
    <main className="site-news">
      <header className="site-news-header">
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {notes.length === 0 ? (
        <p className="site-news-empty">아직 올라온 글이 없어요</p>
      ) : (
        <ol className="site-news-list">
          {notes.map((note, index) => (
            <li key={note.id}>
              <article id={note.id} className="site-news-item" aria-labelledby={`${note.id}-title`}>
                <p className="site-news-meta">
                  {showId && <span className="site-news-tag">{note.id}</span>}
                  {index === 0 && <span className="site-news-new">최신</span>}
                  <time dateTime={note.date}>{formatDate(note.date)}</time>
                </p>
                <h2 id={`${note.id}-title`}>{note.title}</h2>
                {note.blocks.map((block, i) =>
                  block.kind === 'heading' ? (
                    <h3 key={i}>{block.text}</h3>
                  ) : block.kind === 'list' ? (
                    <ul key={i}>
                      {block.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p key={i}>{block.text}</p>
                  ),
                )}
              </article>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
