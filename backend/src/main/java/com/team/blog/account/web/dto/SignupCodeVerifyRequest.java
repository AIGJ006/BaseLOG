package com.team.blog.account.web.dto;

/** 가입 인증 코드 확인 요청. 코드 값은 {@link #toString()}·로그에 나오지 않는다(FR-015). */
public record SignupCodeVerifyRequest(String email, String code) {

    @Override
    public String toString() {
        return "SignupCodeVerifyRequest[email=***, code=***]";
    }
}
