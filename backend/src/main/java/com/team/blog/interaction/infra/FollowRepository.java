package com.team.blog.interaction.infra;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * 팔로우 관계 ({@code follow}, interaction 모듈 소유). 020에서 팔로우를 빼고 친구로 바꿔(2026-10-12) 화면·API는 더 이상 이 테이블을
 * 읽거나 쓰지 않는다. 테이블과 남은 행은 되돌리기 쉽게 그대로 두고, 탈퇴 정리(order 65)만 그 회원의 행을 지운다 — {@code follow}의 FK가 {@code
 * ON DELETE RESTRICT}라 남겨 두면 익명 처리가 막힌다.
 */
@Repository
public class FollowRepository {

    private final JdbcClient jdbc;

    public FollowRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * 그 회원의 팔로우 관계를 양방향 모두 지운다 (015 탈퇴 정리 order 65, 010 contracts §7). 이벤트는 내지 않는다.
     *
     * @return 지운 행 수
     */
    public int deleteAllOf(long memberId) {
        return jdbc.sql("DELETE FROM follow WHERE follower_id = :m OR followee_id = :m")
                .param("m", memberId)
                .update();
    }
}
