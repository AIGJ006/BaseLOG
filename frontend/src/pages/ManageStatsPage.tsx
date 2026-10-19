import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getMyStats, type MyStats, type StatCounts } from '../api/stats';
import { useSession } from '../features/auth/useSession';
import DailyBarChart from '../features/stats/DailyBarChart';
import { longDate, statNumber } from '../features/stats/statFormat';
import VisibilityBadge from '../features/visibility/VisibilityBadge';
import '../features/admin/admin.css';
import '../features/admin/adminStats.css';

type Measure = 'visitors' | 'views' | 'likes' | 'comments';

const MEASURE_LABELS: Record<Measure, string> = {
  visitors: '방문자',
  views: '조회수',
  likes: '받은 좋아요',
  comments: '받은 댓글',
};

/**
 * 내 둥지 관리의 [통계] `/manage/stats` (2026-10-15 민서 요청). 내 둥지 방문자(031, 오늘·7일·30일·누적), 내 글
 * 조회수(오늘·7일·30일·누적), 최근 30일 그래프(방문자 / 조회수 / 받은 좋아요 / 받은 댓글), 글·좋아요·댓글 표, 최근 30일 많이 본 내 글.
 */
export default function ManageStatsPage() {
  const { me } = useSession();
  const [stats, setStats] = useState<MyStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [measure, setMeasure] = useState<Measure>('visitors');

  useEffect(() => {
    let cancelled = false;
    getMyStats()
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
    <section className="manage-page manage-stats" data-route="manage-stats">
      <div className="manage-header">
        <h2>통계</h2>
        {stats ? <span className="admin-muted">{longDate(stats.today)} 기준</span> : null}
        <button type="button" className="btn stats-refresh" onClick={() => setRetry((n) => n + 1)}>
          새로고침
        </button>
      </div>
      {failed ? (
        <p role="alert" className="manage-page-error">
          통계를 불러오지 못했어요{' '}
          <button type="button" onClick={() => setRetry((n) => n + 1)}>
            다시 시도
          </button>
        </p>
      ) : null}
      {!stats && !failed ? <p aria-busy="true">불러오는 중…</p> : null}
      {stats ? (
        <>
          <section aria-labelledby="my-stats-visitors">
            <h3 id="my-stats-visitors" className="stats-heading">
              둥지 방문자
            </h3>
            <div className="stats-tiles">
              <Tile group="visitors" label="오늘" value={stats.visitors.today} />
              <Tile group="visitors" label="최근 7일" value={stats.visitors.last7Days} />
              <Tile group="visitors" label="최근 30일" value={stats.visitors.last30Days} />
              <Tile group="visitors" label="누적" value={stats.visitors.total} />
            </div>
            <p className="admin-muted stats-note">
              내 둥지에 들어온 사람 수예요. 같은 사람은 하루 한 번만 세고, 나와 검색 로봇은 세지
              않아요.
            </p>
          </section>

          <section aria-labelledby="my-stats-views">
            <h3 id="my-stats-views" className="stats-heading">
              글 조회수
            </h3>
            <div className="stats-tiles">
              <Tile group="views" label="오늘" value={stats.views.today} />
              <Tile group="views" label="최근 7일" value={stats.views.last7Days} />
              <Tile group="views" label="최근 30일" value={stats.views.last30Days} />
              <Tile group="views" label="누적" value={stats.views.total} />
            </div>
            <p className="admin-muted stats-note">
              글 화면의 조회수와 같아요. 같은 사람은 하루 한 번만 세고, 검색 로봇은 세지 않아요.
            </p>
          </section>

          <section aria-labelledby="my-stats-daily">
            <div className="stats-heading-row">
              <h3 id="my-stats-daily" className="stats-heading">
                최근 30일
              </h3>
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
              values={stats.daily.map((d) => d[measure])}
              label={MEASURE_LABELS[measure]}
            />
          </section>

          <section aria-labelledby="my-stats-activity">
            <h3 id="my-stats-activity" className="stats-heading">
              활동
            </h3>
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
                <CountRow label="등록한 글" counts={stats.posts} />
                <CountRow label="받은 좋아요" counts={stats.likes} />
                <CountRow label="받은 댓글" counts={stats.comments} />
              </tbody>
            </table>
            <p className="admin-muted stats-note">내가 누른 좋아요와 내가 쓴 댓글은 세지 않아요.</p>
          </section>

          <section aria-labelledby="my-stats-top">
            <h3 id="my-stats-top" className="stats-heading">
              최근 30일 많이 본 글
            </h3>
            {stats.topPosts.length === 0 ? (
              <p className="admin-muted">아직 조회된 글이 없어요</p>
            ) : (
              <ol className="stats-top" data-testid="my-top-posts">
                {stats.topPosts.map((post, i) => (
                  <li key={post.postId}>
                    <span className="stats-top-rank">{i + 1}</span>
                    <span className="stats-top-main">
                      <VisibilityBadge visibility={post.visibility} compact />
                      {me ? (
                        <Link to={`/@${me.handle}/posts/${post.postId}`}>{post.title}</Link>
                      ) : (
                        <span>{post.title}</span>
                      )}
                    </span>
                    <span className="stats-top-views">{statNumber.format(post.views)}회</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </>
      ) : null}
    </section>
  );
}

function Tile({
  group,
  label,
  value,
}: Readonly<{ group: 'visitors' | 'views'; label: string; value: number }>) {
  return (
    <div className="stats-tile" data-testid={`my-tile-${group}-${label}`}>
      <span className="stats-tile-label">{label}</span>
      <span className="stats-tile-value">{statNumber.format(value)}</span>
    </div>
  );
}

function CountRow({
  label,
  counts,
}: Readonly<{ label: string; counts: Pick<StatCounts, 'today' | 'last7Days' | 'total'> }>) {
  return (
    <tr>
      <th scope="row">{label}</th>
      <td>{statNumber.format(counts.today)}</td>
      <td>{statNumber.format(counts.last7Days)}</td>
      <td>{statNumber.format(counts.total)}</td>
    </tr>
  );
}
