package com.team.blog.stats.application;

import java.time.LocalDate;
import java.util.List;

/**
 * 관리자 통계 응답 ({@code GET /api/admin/stats}, 024). 날짜는 서비스 시간대(Asia/Seoul).
 *
 * @param today 기준 날짜(오늘)
 * @param visitors 방문자 요약
 * @param daily 최근 {@value AdminStatsService#DAYS}일 일별(오래된 날부터, 오늘 포함, 없는 날은 0)
 * @param members 회원 수
 * @param posts 글 수
 * @param comments 댓글 수
 * @param views 글 조회수 요약
 * @param topPosts 최근 7일 많이 본 전체 공개 글(최대 {@value AdminStatsService#TOP_POSTS}개)
 */
public record AdminStats(
        LocalDate today,
        Visitors visitors,
        List<Day> daily,
        Counts members,
        Counts posts,
        Counts comments,
        Views views,
        List<TopPost> topPosts) {

    /**
     * @param since 처음 센 날(아직 없으면 null) — 누적은 이날부터다
     */
    public record Visitors(
            long today,
            long yesterday,
            long last7Days,
            long last30Days,
            long total,
            LocalDate since) {}

    /** 하루: 방문자, 그중 로그인 회원, 글 조회수. */
    public record Day(LocalDate date, long visitors, long memberVisitors, long views) {}

    /** 전체, 오늘, 최근 7일(오늘 포함). */
    public record Counts(long total, long today, long last7Days) {}

    /** 오늘, 최근 7일, 누적. */
    public record Views(long today, long last7Days, long total) {}

    public record TopPost(long postId, String title, String handle, long views) {}
}
