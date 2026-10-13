/**
 * 둥지 꾸미기·새 키우기 (021, 2026-10-13 민서 요청). 출석·글·댓글·받은 좋아요로 포인트를 쌓고, 상점에서 배경·테두리·장식을 사서 둥지에 장착한다. 연속
 * 출석하면 새가 자라고, 오래 오지 않으면 작아진다.
 *
 * <p>{@code nest}·{@code nest_point}·{@code nest_item} 테이블은 이 모듈만 쓴다. 글·댓글·좋아요는 이벤트({@code
 * PostPublished}·{@code CommentCreated}·{@code PostLiked})로만 받는다 — 이벤트가 빠져도 핵심 기능은
 * 그대로다(constitution V).
 */
package com.team.blog.nest;
