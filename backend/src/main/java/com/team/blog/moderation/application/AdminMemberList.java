package com.team.blog.moderation.application;

import com.team.blog.account.application.AdminMemberRow;
import java.util.List;

/**
 * 관리자 회원 목록 한 쪽 (가입 최근 순).
 *
 * @param page 1부터 센다
 * @param total 조건에 맞는 전체 회원 수
 * @param totalPages 전체 쪽 수 (회원이 없으면 0)
 */
public record AdminMemberList(
        List<AdminMemberRow> items, int page, int size, long total, int totalPages) {}
