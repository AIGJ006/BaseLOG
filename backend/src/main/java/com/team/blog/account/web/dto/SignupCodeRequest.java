package com.team.blog.account.web.dto;

/** 가입 인증 코드 받기 요청. {@code socialSignup}이 true면 소셜 가입 마무리 화면에서 보낸 것이라 이미 가입된 이메일인지 보지 않는다. */
public record SignupCodeRequest(String email, Boolean socialSignup) {

    public boolean forEmailSignup() {
        return !Boolean.TRUE.equals(socialSignup);
    }
}
