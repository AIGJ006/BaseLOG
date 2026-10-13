package com.team.blog.nest.application;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * 둥지 포인트·새 크기 설정값 ({@code blog.nest.*}, 021 research R3, constitution VII).
 *
 * @param attendancePoints 하루 첫 출석 포인트 (기본 10)
 * @param streakBonusEvery 연속 출석 보너스 주기, 일 (기본 7)
 * @param streakBonusPoints 연속 출석 보너스 포인트 (기본 30)
 * @param postPoints 글 등록 1건 포인트 (기본 20)
 * @param postDailyCap 글 포인트를 받는 하루 최대 건수 (기본 3)
 * @param commentPoints 댓글 1건 포인트 (기본 5)
 * @param commentDailyCap 댓글 포인트를 받는 하루 최대 건수 (기본 5)
 * @param likePoints 받은 좋아요 1건 포인트 (기본 2)
 * @param likeDailyCap 좋아요 포인트를 받는 하루 최대 건수 (기본 20)
 * @param growEveryDays 연속 출석 며칠마다 새가 한 단계 자라는지 (기본 3)
 * @param shrinkAfterDays 며칠 넘게 빠지면 하루 한 단계씩 작아지는지 (기본 3)
 */
@Validated
@ConfigurationProperties("blog.nest")
public record NestProperties(
        @Min(1) @Max(1000) @DefaultValue("10") int attendancePoints,
        @Min(2) @Max(365) @DefaultValue("7") int streakBonusEvery,
        @Min(0) @Max(1000) @DefaultValue("30") int streakBonusPoints,
        @Min(1) @Max(1000) @DefaultValue("20") int postPoints,
        @Min(0) @Max(100) @DefaultValue("3") int postDailyCap,
        @Min(1) @Max(1000) @DefaultValue("5") int commentPoints,
        @Min(0) @Max(100) @DefaultValue("5") int commentDailyCap,
        @Min(1) @Max(1000) @DefaultValue("2") int likePoints,
        @Min(0) @Max(1000) @DefaultValue("20") int likeDailyCap,
        @Min(1) @Max(365) @DefaultValue("3") int growEveryDays,
        @Min(1) @Max(365) @DefaultValue("3") int shrinkAfterDays) {}
