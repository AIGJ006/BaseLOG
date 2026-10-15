/**
 * stats 모듈: 관리자 통계 (024, 2026-10-14 민서 요청). 화면은 {@code /admin/stats}.
 *
 * <ul>
 *   <li>방문자: 화면이 하루 한 번 {@code POST /api/visits}를 보내면 그날 방문자를 Redis HyperLogLog에 더하고(누가 왔는지는 남지
 *       않는다), 5분마다 그날 수만 {@code site_visit_daily}에 옮긴다. 방문자 구분은 009 {@code VisitorKeyResolver}와 같다
 *       (회원 번호, 비회원은 {@code vid} 쿠키 해시). 봇·미리 불러오기·관리자는 세지 않는다.
 *   <li>관리자 통계 {@code GET /api/admin/stats}: 방문자(오늘·어제·7일·30일·누적), 일별 방문자·글 조회수 30일, 회원·글·댓글 수, 최근
 *       7일 많이 본 글.
 * </ul>
 *
 * <p>{@code site_visit_daily}는 이 모듈만 읽고 쓴다. <b>원칙 II 읽기 예외</b>: 회원·글·댓글 수와 일별 조회수는 관리자 화면 한 번에 여러
 * 모듈의 합계만 읽으므로 {@code StatsQueryRepository}가 {@code member}·{@code post}·{@code comment}·{@code
 * post_view_daily}를 읽기 전용으로 센다(012 {@code TrendingRepository}와 같은 방식).
 */
package com.team.blog.stats;
