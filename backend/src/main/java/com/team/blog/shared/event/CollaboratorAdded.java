package com.team.blog.shared.event;

import java.time.Instant;

/**
 * 글쓴이가 친구를 글의 공동 작업자로 더했다 (030). 이미 공동 작업자였던 회원은 발행하지 않는다. 구독: 011 알림.
 *
 * @param postId 글 번호
 * @param authorId 글쓴이 (더한 사람)
 * @param collaboratorId 더해진 회원
 * @param addedAt 더한 시각
 */
public record CollaboratorAdded(long postId, long authorId, long collaboratorId, Instant addedAt)
        implements DomainEvent {}
