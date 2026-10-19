/**
 * stats 모듈: 관리자 통계 (024, 2026-10-14 민서 요청). 화면은 {@code /admin/stats}.
 *
 * <ul>
 *   <li>방문자: 화면이 하루 한 번 {@code POST /api/visits}를 보내면 그날 방문자를 Redis HyperLogLog에 더하고(누가 왔는지는 남지
 *       않는다), 5분마다 그날 수만 {@code site_visit_daily}에 옮긴다. 방문자 구분은 009 {@code VisitorKeyResolver}와 같다
 *       (회원 번호, 비회원은 {@code vid} 쿠키 해시). 봇·미리 불러오기·관리자는 세지 않는다.
 *   <li>관리자 통계 {@code GET /api/admin/stats}: 방문자(오늘·어제·7일·30일·누적), 일별 방문자·글 조회수 30일, 회원·글·댓글 수, 최근
 *       7일 많이 본 글.
 *   <li>내 둥지 통계 {@code GET /api/me/stats}(2026-10-15, 내 둥지 관리 [통계]): 본인 글의 조회수(오늘·7일·30일·누적), 일별
 *       조회수·받은 좋아요·받은 댓글 30일, 글·좋아요·댓글 수, 최근 30일 많이 본 내 글.
 *   <li>둥지별 방문자(031, 2026-10-19): 화면이 둥지({@code /@주소})를 열면 둥지마다 하루 한 번 {@code POST
 *       /api/members/{handle}/visits}를 보내고, 둥지마다 그날 방문자를 Redis HyperLogLog에 더해 5분마다 {@code
 *       blog_visit_daily}에 옮긴다. 주인 본인·관리자·봇은 세지 않는다. 내 둥지 통계에 방문자(오늘·7일·30일·누적)와 일별 방문자가 붙는다.
 * </ul>
 *
 * <p>{@code site_visit_daily}·{@code blog_visit_daily}는 이 모듈만 읽고 쓴다. <b>원칙 II 읽기 예외</b>: 회원·글·댓글 수와
 * 일별 조회수는 관리자 화면 한 번에 여러 모듈의 합계만 읽으므로 {@code StatsQueryRepository}·{@code MyStatsQueryRepository}가
 * {@code member}·{@code post}·{@code comment}·{@code post_view_daily}를 읽기 전용으로 센다(012 {@code
 * TrendingRepository}와 같은 방식).
 */
package com.team.blog.stats;
