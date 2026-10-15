import { useState, type ReactNode } from 'react';
import { longDate, shortDate, statNumber } from './statFormat';
import '../admin/admin.css';
import '../admin/adminStats.css';

/**
 * 일별 막대 그래프(관리자 통계·내 둥지 통계). 막대 하나에 하루. 마우스를 올리거나 눌러 고르면 그날 값을 위에 보여 준다. 표 보기(숨김)로
 * 화면 읽기 프로그램도 읽는다. 색은 브랜드 한 가지.
 */
export default function DailyBarChart({
  dates,
  values,
  label,
  detail,
}: Readonly<{
  /** 오래된 날부터 `YYYY-MM-DD` */
  dates: string[];
  values: number[];
  /** 값 이름(예: 글 조회수) */
  label: string;
  /** 고른 날의 덧붙임 글(예: 회원 수) */
  detail?: (index: number) => ReactNode;
}>) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const picked = active ?? dates.length - 1;
  const date = dates[picked];
  const total = values.reduce((a, b) => a + b, 0);

  return (
    <figure className="stats-chart">
      <figcaption className="stats-chart-readout" aria-live="polite">
        <span className="admin-muted">{date ? longDate(date) : ''}</span>
        <strong>
          {label} {statNumber.format(values[picked] ?? 0)}
        </strong>
        {date && detail ? <span className="admin-muted">{detail(picked)}</span> : null}
        <span className="admin-muted stats-chart-sum">
          {dates.length}일 합계 {statNumber.format(total)}
        </span>
      </figcaption>
      <div className="stats-bars" aria-hidden="true" onMouseLeave={() => setActive(null)}>
        <span className="stats-axis-max">{statNumber.format(max)}</span>
        {dates.map((d, i) => (
          <button
            key={d}
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
        {dates.map((d, i) => (
          <span key={d}>{(dates.length - 1 - i) % 7 === 0 ? shortDate(d) : ''}</span>
        ))}
      </div>
      <table className="visually-hidden">
        <caption>
          최근 {dates.length}일 {label}
        </caption>
        <tbody>
          {dates.map((d, i) => (
            <tr key={d}>
              <th scope="row">{d}</th>
              <td>{values[i]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
