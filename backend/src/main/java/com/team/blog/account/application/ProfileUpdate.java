package com.team.blog.account.application;

/**
 * 프로필 저장 요청 (openapi {@code ProfileUpdateRequest}). 보낸 칸만 {@code *Present = true}. {@code bio =
 * null}은 소개 비우기, {@code profileImageId = null}은 기본 이미지로, {@code bannerImageId = null}은 기본
 * 배경으로(025), {@code bannerColor = null}은 기본 배경색으로(025 배너 색).
 */
public record ProfileUpdate(
        boolean nicknamePresent,
        String nickname,
        boolean bioPresent,
        String bio,
        boolean profileImagePresent,
        Long profileImageId,
        boolean bannerImagePresent,
        Long bannerImageId,
        boolean bannerColorPresent,
        String bannerColor) {

    public boolean isEmpty() {
        return !nicknamePresent
                && !bioPresent
                && !profileImagePresent
                && !bannerImagePresent
                && !bannerColorPresent;
    }
}
