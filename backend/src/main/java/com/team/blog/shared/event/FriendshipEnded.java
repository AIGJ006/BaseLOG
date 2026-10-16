package com.team.blog.shared.event;

/**
 * 친구 관계·요청 행이 지워졌다 (거절·취소·끊기, 030). 상대에게 알리지 않는다. 구독: 030 공동 작업자 정리(같은 트랜잭션).
 *
 * @param memberId 지운 회원
 * @param otherMemberId 상대 회원
 */
public record FriendshipEnded(long memberId, long otherMemberId) implements DomainEvent {}
