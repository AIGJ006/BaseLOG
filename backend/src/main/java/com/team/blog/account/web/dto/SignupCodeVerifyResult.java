package com.team.blog.account.web.dto;

/** 가입 인증 코드 확인 결과 {@code {verified: true, signupToken}}. 토큰은 가입 요청에 그대로 실어 보내며, 코드를 맞힌 쪽만 받는다. */
public record SignupCodeVerifyResult(boolean verified, String signupToken) {

    @Override
    public String toString() {
        return "SignupCodeVerifyResult[verified=" + verified + "]";
    }
}
