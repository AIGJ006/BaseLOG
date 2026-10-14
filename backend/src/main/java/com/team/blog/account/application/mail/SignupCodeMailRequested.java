package com.team.blog.account.application.mail;

/**
 * 가입 전 이메일 인증 코드 메일 (2026-10-14). 코드는 Redis에 저장한 뒤 {@code mailExecutor}에서 보낸다. 이메일·코드는 메모리 안에서만 오가고
 * 로그에 남기지 않는다(FR-015).
 */
public record SignupCodeMailRequested(String email, String code) {

    @Override
    public String toString() {
        return "SignupCodeMailRequested[email=***, code=***]";
    }
}
