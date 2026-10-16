import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminStats, type AdminStats, type StatCounts } from '../../api/stats';
import AdminNav from '../../features/admin/AdminNav';
import { ADMIN_TEXT } from '../../features/admin/adminText';
import DailyBarChart from '../../features/stats/DailyBarChart';
import { longDate, shortDate, statNumber } from '../../features/stats/statFormat';
import '../../features/admin/admin.css';
import '../../features/admin/adminStats.css';

type Measure = 'visitors' | 'views';

const MEASURE_LABELS: Record<Measure, string> = { visitors: '방문자', views: '글 조회수' };

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
              <fieldset className="stats-toggle" aria-label="그래프 항목">
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
              </fieldset>
            </div>
            <DailyBarChart
              dates={stats.daily.map((d) => d.date)}
              values={stats.daily.map((d) => (measure === 'visitors' ? d.visitors : d.views))}
              label={MEASURE_LABELS[measure]}
              detail={
                measure === 'visitors'
                  ? (i) => `회원 ${statNumber.format(stats.daily[i].memberVisitors)}`
                  : undefined
              }
            />
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
                    <span className="stats-top-views">{statNumber.format(post.views)}회</span>
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

function Tile({ label, value, note }: Readonly<{ label: string; value: number; note?: string }>) {
  return (
    <div className="stats-tile" data-testid={`tile-${label}`}>
      <span className="stats-tile-label">{label}</span>
      <span className="stats-tile-value">{statNumber.format(value)}</span>
      {note ? <span className="admin-muted stats-tile-note">{note}</span> : null}
    </div>
  );
}

function CountRow({
  label,
  counts,
}: Readonly<{
  label: string;
  counts: Pick<StatCounts, 'today' | 'last7Days' | 'total'>;
}>) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{statNumber.format(counts.today)}</td>
      <td>{statNumber.format(counts.last7Days)}</td>
      <td>{statNumber.format(counts.total)}</td>
    </tr>
  );
}
