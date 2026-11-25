package com.team.blog.shared.web;

/**
 * 방문자 쿠키 이름 (009 조회수·012 검색·021 방문 통계가 함께 쓴다). 쿠키를 처음 주는 일은 interaction 모듈의 {@code
 * VisitorIdCookieFilter}가 하고, 다른 모듈은 이 이름으로 읽기만 한다.
 */
public final class VisitorCookie {

    /** {@code vid={UUID}} */
    public static final String NAME = "vid";

    private VisitorCookie() {}
}
