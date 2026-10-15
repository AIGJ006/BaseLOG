import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminStats, type AdminStats, type StatCounts } from '../../api/stats';
import AdminNav from '../../features/admin/AdminNav';
import { ADMIN_TEXT } from '../../features/admin/adminText';
import '../../features/admin/admin.css';
import '../../features/admin/adminStats.css';

type Measure = 'visitors' | 'views';

const MEASURE_LABELS: Record<Measure, string> = { visitors: '방문자', views: '글 조회수' };

const number = new Intl.NumberFormat('ko-KR');

/** `2026-10-14` → `10/14` */
function shortDate(date: string): string {
  const [, m, d] = date.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** `2026-10-14` → `2026년 10월 14일` */
function longDate(date: string): string {
  const [y, m, d] = date.split('-');
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

/**
 * 024 관리자 통계 `/admin/stats` (관리자만, 004 `AdminRouteGate` 아래). 방문자(오늘·어제·7일·누적), 최근 30일 그래프(방문자 /
 * 글 조회수), 회원·글·댓글·조회수 표, 최근 7일 많이 본 글. 방문자는 5분마다 모으고, 관리자·봇은 세지 않는다.
 */
export default function AdminStatsPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [measure, setMeasure] = useState<Measure>('visitors');

  useEffect(() => {
    let cancelled = false;
    getAdminStats()
      .then((s) => {
        if (cancelled) return;
        setStats(s);
        setFailed(false);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [retry]);

  return (
    <main className="admin-page" data-route="admin-stats">
      <AdminNav />
      <div className="admin-title-row">
        <h1>{ADMIN_TEXT.statsTitle}</h1>
        {stats ? <span className="admin-muted">{longDate(stats.today)} 기준</span> : null}
        <button
          type="button"
          className="admin-button stats-refresh"
          onClick={() => setRetry((n) => n + 1)}
        >
          새로고침
        </button>
      </div>
      {failed ? (
        <p role="alert" className="admin-error">
          {ADMIN_TEXT.loadFailed}{' '}
          <button type="button" className="admin-button" onClick={() => setRetry((n) => n + 1)}>
            {ADMIN_TEXT.reload}
          </button>
        </p>
      ) : null}
      {!stats && !failed ? <p className="admin-muted">{ADMIN_TEXT.loading}</p> : null}
      {stats ? (
        <>
          <section aria-labelledby="stats-visitors">
            <h2 id="stats-visitors" className="stats-heading">
              방문자
            </h2>
            <div className="stats-tiles">
              <Tile label="오늘" value={stats.visitors.today} />
              <Tile label="어제" value={stats.visitors.yesterday} />
              <Tile label="최근 7일" value={stats.visitors.last7Days} />
              <Tile
                label="누적"
                value={stats.visitors.total}
                note={stats.visitors.since ? `${shortDate(stats.visitors.since)}부터` : undefined}
              />
            </div>
            <p className="admin-muted stats-note">
              같은 사람은 하루 한 번만 세요. 관리자와 검색 로봇은 세지 않고, 5분마다 모아요.
            </p>
          </section>

          <section aria-labelledby="stats-daily">
            <div className="stats-heading-row">
              <h2 id="stats-daily" className="stats-heading">
                최근 30일
              </h2>
              <div className="stats-toggle" role="group" aria-label="그래프 항목">
                {(Object.keys(MEASURE_LABELS) as Measure[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={measure === m}
                    onClick={() => setMeasure(m)}
                  >
                    {MEASURE_LABELS[m]}
                  </button>
                ))}
              </div>
            </div>
            <DailyChart daily={stats.daily} measure={measure} />
          </section>

          <section aria-labelledby="stats-activity">
            <h2 id="stats-activity" className="stats-heading">
              활동
            </h2>
            <table className="stats-table">
              <thead>
                <tr>
                  <th scope="col">
                    <span className="visually-hidden">항목</span>
                  </th>
                  <th scope="col">오늘</th>
                  <th scope="col">최근 7일</th>
                  <th scope="col">전체</th>
                </tr>
              </thead>
              <tbody>
                <CountRow label="새 회원" counts={stats.members} />
                <CountRow label="새 글" counts={stats.posts} />
                <CountRow label="새 댓글" counts={stats.comments} />
                <CountRow
                  label="글 조회수"
                  counts={{
                    today: stats.views.today,
                    last7Days: stats.views.last7Days,
                    total: stats.views.total,
                  }}
                />
              </tbody>
            </table>
          </section>

          <section aria-labelledby="stats-top">
            <h2 id="stats-top" className="stats-heading">
              최근 7일 많이 본 글
            </h2>
            {stats.topPosts.length === 0 ? (
              <p className="admin-muted">아직 조회된 글이 없어요</p>
            ) : (
              <ol className="stats-top" data-testid="top-posts">
                {stats.topPosts.map((post, i) => (
                  <li key={post.postId}>
                    <span className="stats-top-rank">{i + 1}</span>
                    <span className="stats-top-main">
                      <Link to={`/@${post.handle}/posts/${post.postId}`}>{post.title}</Link>
                      <span className="admin-muted">@{post.handle}</span>
                    </span>
                    <span className="stats-top-views">{number.format(post.views)}회</span>
                  </li>
                ))}
              </ol>
            )}
            <p className="admin-muted stats-note">전체 공개 글만 보여요.</p>
          </section>
        </>
      ) : null}
    </main>
  );
}

function Tile({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="stats-tile" data-testid={`tile-${label}`}>
      <span className="stats-tile-label">{label}</span>
      <span className="stats-tile-value">{number.format(value)}</span>
      {note ? <span className="admin-muted stats-tile-note">{note}</span> : null}
    </div>
  );
}

function CountRow({
  label,
  counts,
}: {
  label: string;
  counts: Pick<StatCounts, 'today' | 'last7Days' | 'total'>;
}) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{number.format(counts.today)}</td>
      <td>{number.format(counts.last7Days)}</td>
      <td>{number.format(counts.total)}</td>
    </tr>
  );
}

/** 막대 하나에 하루. 마우스를 올리거나 눌러 고르면 그날 값을 위에 보여 준다. 표 보기(숨김)로 화면 읽기 프로그램도 읽는다 */
function DailyChart({ daily, measure }: { daily: AdminStats['daily']; measure: Measure }) {
  const [active, setActive] = useState<number | null>(null);
  const values = daily.map((d) => (measure === 'visitors' ? d.visitors : d.views));
  const max = Math.max(1, ...values);
  const picked = active ?? daily.length - 1;
  const day = daily[picked];
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <figure className="stats-chart">
      <figcaption className="stats-chart-readout" aria-live="polite">
        <span className="admin-muted">{day ? longDate(day.date) : ''}</span>
        <strong>
          {MEASURE_LABELS[measure]} {number.format(values[picked] ?? 0)}
        </strong>
        {day && measure === 'visitors' ? (
          <span className="admin-muted">회원 {number.format(day.memberVisitors)}</span>
        ) : null}
        <span className="admin-muted stats-chart-sum">30일 합계 {number.format(total)}</span>
      </figcaption>
      <div className="stats-bars" aria-hidden="true" onMouseLeave={() => setActive(null)}>
        <span className="stats-axis-max">{number.format(max)}</span>
        {daily.map((d, i) => (
          <button
            key={d.date}
            type="button"
            tabIndex={-1}
            className="stats-bar-slot"
            data-active={i === picked}
            onMouseEnter={() => setActive(i)}
            onClick={() => setActive(i)}
          >
            <span
              className="stats-bar"
              style={{ height: values[i] === 0 ? 0 : `${Math.max(2, (values[i] / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="stats-x" aria-hidden="true">
        {daily.map((d, i) => (
          <span key={d.date}>{(daily.length - 1 - i) % 7 === 0 ? shortDate(d.date) : ''}</span>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>최근 30일 {MEASURE_LABELS[measure]}</caption>
        <tbody>
          {daily.map((d, i) => (
            <tr key={d.date}>
              <th scope="row">{d.date}</th>
              <td>{values[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
