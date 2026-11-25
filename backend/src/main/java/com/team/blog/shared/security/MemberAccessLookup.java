package com.team.blog.shared.security;

import java.util.Optional;

/**
 * 권한 판정용 회원 정보를 읽는 포트. shared는 account 모듈을 모르고, account 모듈의 {@code MemberQueryService}가 구현한다(루트
 * {@code package-info} 모듈 경계 규칙).
 */
public interface MemberAccessLookup {

    /** 지워지지 않은 회원의 역할·상태·이메일 인증 여부. 없으면 빈 값. */
    Optional<MemberAccessInfo> findAccessInfo(long memberId);
}
