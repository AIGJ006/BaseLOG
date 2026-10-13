package com.team.blog.account.application;

import com.team.blog.account.domain.MemberStatus;
import com.team.blog.account.domain.Role;
import java.time.Instant;

/**
 * 관리자 회원 목록 한 줄. 익명 처리된 회원은 만들지 않는다.
 *
 * @param email 가입·로그인 이메일 (소셜 로그인이 이메일을 주지 않았으면 {@code null}). 관리자 화면에만 나간다
 * @param provider 로그인 방식 {@code LOCAL}·{@code GITHUB}·{@code GOOGLE} (로그인 수단이 없으면 {@code null})
 * @param lastLoginAt 마지막 로그인 (한 번도 없으면 {@code null})
 */
public record AdminMemberRow(
        String handle,
        String nickname,
        String email,
        String provider,
        Role role,
        MemberStatus status,
        Instant joinedAt,
        Instant lastLoginAt) {}
