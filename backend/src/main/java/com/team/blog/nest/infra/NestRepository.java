package com.team.blog.nest.infra;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** 둥지·포인트 기록·산 물건 저장과 조회 (021 data-model). 이 모듈의 세 테이블만 읽고 쓴다. */
@Repository
public class NestRepository {

    private final JdbcClient jdbc;

    public NestRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** 둥지 한 줄. 아직 없으면 기본값으로 본다({@link #empty}). */
    public record NestRow(
            long memberId,
            int birdLevel,
            int streakDays,
            int bestStreakDays,
            LocalDate lastAttendedOn,
            String background,
            String nestType) {

        public static NestRow empty(long memberId) {
            return new NestRow(memberId, 1, 0, 0, null, "bg-basic", "nest-basic");
        }
    }

    /** 포인트 기록 한 줄. */
    public record PointRow(
            long id, String reason, int amount, String sourceKey, Instant createdAt) {}

    /** 산 물건 한 줄. */
    public record ItemRow(String code, boolean equipped) {}

    /** 둥지 줄이 없으면 만든다. 없는 회원이면 외래 키 오류. */
    public void ensure(long memberId) {
        jdbc.sql("INSERT INTO nest (member_id) VALUES (:m) ON CONFLICT (member_id) DO NOTHING")
                .param("m", memberId)
                .update();
    }

    /** 같은 회원의 둥지 쓰기(출석·포인트·사기)를 한 줄로 세운다. {@link #ensure} 뒤에 부른다. */
    public NestRow lock(long memberId) {
        return jdbc.sql(SELECT + " WHERE member_id = :m FOR UPDATE")
                .param("m", memberId)
                .query(NestRepository::map)
                .single();
    }

    public Optional<NestRow> find(long memberId) {
        return jdbc.sql(SELECT + " WHERE member_id = :m")
                .param("m", memberId)
                .query(NestRepository::map)
                .optional();
    }

    public void saveAttendance(
            long memberId, int level, int streak, int bestStreak, LocalDate attendedOn) {
        jdbc.sql(
                        "UPDATE nest SET bird_level = :level, streak_days = :streak,"
                                + " best_streak_days = :best, last_attended_on = :day,"
                                + " updated_at = CURRENT_TIMESTAMP WHERE member_id = :m")
                .param("level", level)
                .param("streak", streak)
                .param("best", bestStreak)
                .param("day", attendedOn)
                .param("m", memberId)
                .update();
    }

    /** 새 단계만 바꾼다 (시험용). */
    public void saveLevel(long memberId, int level) {
        jdbc.sql(
                        "UPDATE nest SET bird_level = :level, updated_at = CURRENT_TIMESTAMP"
                                + " WHERE member_id = :m")
                .param("level", level)
                .param("m", memberId)
                .update();
    }

    public void saveFrame(long memberId, String background, String nestType) {
        jdbc.sql(
                        "UPDATE nest SET background = :bg, nest_type = :nest,"
                                + " updated_at = CURRENT_TIMESTAMP WHERE member_id = :m")
                .param("bg", background)
                .param("nest", nestType)
                .param("m", memberId)
                .update();
    }

    /** 포인트 한 줄을 더한다. 같은 까닭(source_key)이 이미 있으면 더하지 않고 {@code false}. */
    public boolean addPoint(
            long memberId, String reason, int amount, String sourceKey, LocalDate earnedOn) {
        return jdbc.sql(
                                "INSERT INTO nest_point (member_id, reason, amount, source_key, earned_on)"
                                        + " VALUES (:m, :reason, :amount, :key, :day)"
                                        + " ON CONFLICT (member_id, source_key) DO NOTHING")
                        .param("m", memberId)
                        .param("reason", reason)
                        .param("amount", amount)
                        .param("key", sourceKey)
                        .param("day", earnedOn)
                        .update()
                > 0;
    }

    /** 그날 그 까닭으로 받은 건수 (하루 상한). */
    public int countOn(long memberId, String reason, LocalDate day) {
        return jdbc.sql(
                        "SELECT count(*) FROM nest_point"
                                + " WHERE member_id = :m AND reason = :reason AND earned_on = :day")
                .param("m", memberId)
                .param("reason", reason)
                .param("day", day)
                .query(Integer.class)
                .single();
    }

    /** 잔액 = 기록의 합. */
    public long balance(long memberId) {
        return jdbc.sql("SELECT COALESCE(sum(amount), 0) FROM nest_point WHERE member_id = :m")
                .param("m", memberId)
                .query(Long.class)
                .single();
    }

    /** 기록을 새것부터. {@code beforeId}가 있으면 그보다 앞의 것만. */
    public List<PointRow> history(long memberId, Long beforeId, int limit) {
        return jdbc.sql(
                        "SELECT id, reason, amount, source_key, created_at FROM nest_point WHERE member_id = :m"
                                + (beforeId == null ? "" : " AND id < :before")
                                + " ORDER BY id DESC LIMIT :limit")
                .param("m", memberId)
                .params(beforeId == null ? Map.of() : Map.of("before", beforeId))
                .param("limit", limit)
                .query(
                        (rs, n) ->
                                new PointRow(
                                        rs.getLong("id"),
                                        rs.getString("reason"),
                                        rs.getInt("amount"),
                                        rs.getString("source_key"),
                                        rs.getTimestamp("created_at").toInstant()))
                .list();
    }

    public List<ItemRow> items(long memberId) {
        return jdbc.sql(
                        "SELECT item_code, equipped FROM nest_item WHERE member_id = :m"
                                + " ORDER BY bought_at, item_code")
                .param("m", memberId)
                .query((rs, n) -> new ItemRow(rs.getString("item_code"), rs.getBoolean("equipped")))
                .list();
    }

    /** 산 물건을 더한다. 이미 있으면 {@code false}. */
    public boolean addItem(long memberId, String code) {
        return jdbc.sql(
                                "INSERT INTO nest_item (member_id, item_code) VALUES (:m, :code)"
                                        + " ON CONFLICT (member_id, item_code) DO NOTHING")
                        .param("m", memberId)
                        .param("code", code)
                        .update()
                > 0;
    }

    /** 장식 장착을 이 묶음으로 바꾼다 (묶음 밖은 내림). */
    public void equipDecorations(long memberId, List<String> codes) {
        jdbc.sql("UPDATE nest_item SET equipped = false WHERE member_id = :m AND equipped")
                .param("m", memberId)
                .update();
        if (codes.isEmpty()) {
            return;
        }
        jdbc.sql(
                        "UPDATE nest_item SET equipped = true"
                                + " WHERE member_id = :m AND item_code IN (:codes)")
                .param("m", memberId)
                .param("codes", codes)
                .update();
    }

    /** 탈퇴 정리 — 그 회원의 둥지·기록·물건 전부. 지운 둥지 수. */
    public int deleteAllByMember(long memberId) {
        jdbc.sql("DELETE FROM nest_item WHERE member_id = :m").param("m", memberId).update();
        jdbc.sql("DELETE FROM nest_point WHERE member_id = :m").param("m", memberId).update();
        return jdbc.sql("DELETE FROM nest WHERE member_id = :m").param("m", memberId).update();
    }

    private static final String SELECT =
            "SELECT member_id, bird_level, streak_days, best_streak_days, last_attended_on,"
                    + " background, nest_type FROM nest";

    private static NestRow map(ResultSet rs, int n) throws SQLException {
        Date last = rs.getDate("last_attended_on");
        return new NestRow(
                rs.getLong("member_id"),
                rs.getInt("bird_level"),
                rs.getInt("streak_days"),
                rs.getInt("best_streak_days"),
                last == null ? null : last.toLocalDate(),
                rs.getString("background"),
                rs.getString("nest_type"));
    }
}
