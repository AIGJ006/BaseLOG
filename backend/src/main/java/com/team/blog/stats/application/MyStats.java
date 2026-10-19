package com.team.blog.stats.application;

import java.time.LocalDate;
import java.util.List;

/**
 * 내 둥지 통계 응답 ({@code GET /api/me/stats}, 2026-10-15 민서 요청). 날짜는 서비스 시간대(Asia/Seoul). 지운 글은 빼고, 받은
 * 좋아요·댓글은 다른 사람이 남긴 것만 센다.
 *
 * @param today 기준 날짜(오늘)
 * @param visitors 내 둥지 방문자 요약(031, 주인 본인 제외)
 * @param views 내 글 조회수 요약
 * @param daily 최근 {@value MyStatsService#DAYS}일 일별(오래된 날부터, 오늘 포함, 없는 날은 0)
 * @param posts 등록한 글 수
 * @param likes 받은 좋아요 수
 * @param comments 받은 댓글 수
 * @param topPosts 최근 {@value MyStatsService#DAYS}일 많이 본 내 글(최대 {@value MyStatsService#TOP_POSTS}개)
 */
public record MyStats(
        LocalDate today,
        Visitors visitors,
        Views views,
        List<Day> daily,
        Counts posts,
        Counts likes,
        Counts comments,
        List<TopPost> topPosts) {

    /** 둥지 방문자: 오늘, 최근 7일, 최근 30일(오늘 포함), 누적. 같은 사람은 하루 한 번만 센다. */
    public record Visitors(long today, long last7Days, long last30Days, long total) {}

    /** 오늘, 최근 7일, 최근 30일(오늘 포함), 누적. */
    public record Views(long today, long last7Days, long last30Days, long total) {}

    /** 하루: 둥지 방문자, 내 글 조회수, 받은 좋아요, 받은 댓글. */
    public record Day(LocalDate date, long visitors, long views, long likes, long comments) {}

    /** 전체, 오늘, 최근 7일(오늘 포함). */
    public record Counts(long total, long today, long last7Days) {}

    /** 공개 범위는 화면이 자물쇠·친구 표시를 붙이도록 함께 준다. */
    public record TopPost(long postId, String title, String visibility, long views) {}
}
