package com.team.blog.account.application;

import com.team.blog.account.infra.FriendshipRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** 친구 여부 공개 조회 (001 T129). 004 친구 공개(선택 기능)와 US8 최근 활동 표시, 020 친구 피드·블로그 머리말·친구 알림이 쓴다. */
@Service
@Transactional(readOnly = true)
public class FriendshipQueryService {

    private final FriendshipRepository friendships;

    public FriendshipQueryService(FriendshipRepository friendships) {
        this.friendships = friendships;
    }

    /** 두 회원이 서로 친구({@code ACCEPTED})인가. 같은 회원이면 false. */
    public boolean areFriends(long a, long b) {
        return a != b && friendships.find(a, b).map(f -> f.isAccepted()).orElse(false);
    }

    /** {@code requesterId}가 보낸 요청이 아직 수락을 기다리는가 (020 친구 요청 알림을 만들기 직전 다시 확인). */
    public boolean isPendingRequest(long requesterId, long receiverId) {
        return requesterId != receiverId
                && friendships
                        .find(requesterId, receiverId)
                        .map(f -> !f.isAccepted() && f.getRequestedBy() == requesterId)
                        .orElse(false);
    }

    /** 친구 수 — 탈퇴한 상대 제외 (020 블로그 머리말). */
    public long friendCount(long memberId) {
        return friendships.countFriends(memberId);
    }

    /** 친구가 한 명이라도 있는가 (020 피드 빈 화면 문구). */
    public boolean hasFriends(long memberId) {
        return friendships.hasFriends(memberId);
    }
}
