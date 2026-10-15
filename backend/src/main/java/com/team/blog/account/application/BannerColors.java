package com.team.blog.account.application;

import java.util.Locale;
import java.util.regex.Pattern;

/** 025 배너 색 검사 (2026-10-15). {@code #rrggbb}(대소문자 무관)만 받고 소문자로 맞춘다. DB CHECK와 같은 규칙. */
public final class BannerColors {

    public static final String FIELD = "bannerColor";
    public static final String INVALID_BANNER_COLOR = "INVALID_BANNER_COLOR";
    public static final String INVALID_BANNER_COLOR_MESSAGE = "배너 색은 #과 16진수 6자리로 적어 주세요";

    private static final Pattern HEX = Pattern.compile("^#[0-9a-fA-F]{6}$");

    private BannerColors() {}

    /** 맞는 값이면 소문자 {@code #rrggbb}, 아니면 {@code null}. */
    public static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.strip();
        return HEX.matcher(trimmed).matches() ? trimmed.toLowerCase(Locale.ROOT) : null;
    }
}
