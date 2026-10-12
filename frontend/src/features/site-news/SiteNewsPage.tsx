import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import type { Note } from './parseNote';
import './siteNews.css';

type Props = {
  title: string;
  intro: string;
  notes: Note[];
  /** 이 화면 주소 (`/notices`·`/releases`). 글 하나는 `{basePath}/{id}` */
  basePath: string;
  /** 글 위 작은 꼬리표 (업데이트 소식은 버전 "v1.0.1") */
  showId?: boolean;
};

function formatDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일` : date;
}

function shortDate(date: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return match ? `${match[1]}. ${Number(match[2])}. ${Number(match[3])}.` : date;
}

/**
 * 공지(`/notices`)·업데이트 소식(`/releases`) 화면. 글은 빌드에 들어간 파일(README.md)이고, 최신 글이 위.
 * 목록은 제목 한 줄씩이고, 누르면 `/releases/v1.0.1`처럼 글 하나 화면으로 들어간다 (2026-10-12 민서 요청).
 * 예전 주소 `/releases#v1.0.1`은 그 글 화면으로 옮긴다.
 */
export default function SiteNewsPage({ title, intro, notes, basePath, showId = false }: Props) {
  const { id } = useParams();
  const { hash } = useLocation();

  if (!id && hash) {
    return (
      <Navigate
        to={`${basePath}/${encodeURIComponent(decodeURIComponent(hash.slice(1)))}`}
        replace
      />
    );
  }
  if (id) {
    const note = notes.find((n) => n.id === id);
    return (
      <main className="site-news">
        <p className="site-news-back">
          <Link to={basePath}>← {title} 목록</Link>
        </p>
        {note ? (
          <NoteArticle note={note} latest={note === notes[0]} showId={showId} />
        ) : (
          <p className="site-news-empty">찾는 글이 없어요</p>
        )}
      </main>
    );
  }

  return (
    <main className="site-news">
      <header className="site-news-header">
        <h1>{title}</h1>
        <p>{intro}</p>
      </header>
      {notes.length === 0 ? (
        <p className="site-news-empty">아직 올라온 글이 없어요</p>
      ) : (
        <ol className="site-news-rows">
          {notes.map((note, index) => (
            <li key={note.id}>
              <Link to={`${basePath}/${encodeURIComponent(note.id)}`} className="site-news-row">
                <span className="site-news-row-title">
                  {showId && <span className="site-news-row-id">{note.id}</span>}
                  {note.title}
                  {index === 0 && <span className="site-news-new">최신</span>}
                </span>
                <time dateTime={note.date}>{shortDate(note.date)}</time>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}

function NoteArticle({ note, latest, showId }: { note: Note; latest: boolean; showId: boolean }) {
  return (
    <article id={note.id} className="site-news-item" aria-labelledby={`${note.id}-title`}>
      <p className="site-news-meta">
        {showId && <span className="site-news-tag">{note.id}</span>}
        {latest && <span className="site-news-new">최신</span>}
        <time dateTime={note.date}>{formatDate(note.date)}</time>
      </p>
      <h1 id={`${note.id}-title`}>{note.title}</h1>
      {note.blocks.map((block, i) =>
        block.kind === 'heading' ? (
          <h2 key={i}>{block.text}</h2>
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
  );
}
