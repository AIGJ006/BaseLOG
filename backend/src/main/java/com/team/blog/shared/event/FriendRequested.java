package com.team.blog.shared.event;

import java.time.Instant;

/**
 * 친구 요청으로 {@code friendship} 행이 새로 생겼다 (001 contracts/events.md §1). 발행: {@code
 * account.application.FriendshipService.requestOrAccept}. 구독: 020 친구 요청 알림({@code
 * FriendNotificationListener}).
 */
public record FriendRequested(long requesterId, long receiverId, Instant requestedAt)
        implements DomainEvent {}
