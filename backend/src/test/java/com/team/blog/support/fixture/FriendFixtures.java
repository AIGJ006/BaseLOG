package com.team.blog.support.fixture;

import org.springframework.jdbc.core.JdbcTemplate;

/** 친구(020) 시험 데이터 (테스트 전용). 서버 흐름 없이 {@code friendship}을 SQL로 바로 넣는다. */
public final class FriendFixtures {

    private final JdbcTemplate jdbc;

    public FriendFixtures(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** 서로 친구({@code ACCEPTED}). {@code a}가 요청한 것으로 둔다. */
    public void friends(long a, long b) {
        insert(a, b, a, true);
    }

    /** {@code from}이 {@code to}에게 보낸, 아직 수락 전 요청. */
    public void request(long from, long to) {
        insert(from, to, from, false);
    }

    private void insert(long x, long y, long requestedBy, boolean accepted) {
        jdbc.update(
                "INSERT INTO friendship (member_a_id, member_b_id, requested_by, status, accepted_at)"
                        + " VALUES (?, ?, ?, ?, CASE WHEN ? THEN now() END)",
                Math.min(x, y),
                Math.max(x, y),
                requestedBy,
                accepted ? "ACCEPTED" : "PENDING",
                accepted);
    }
}
