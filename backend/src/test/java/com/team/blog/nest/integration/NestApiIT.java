package com.team.blog.nest.integration;

import static com.team.blog.nest.support.NestApi.body;
import static com.team.blog.nest.support.NestApi.read;
import static com.team.blog.nest.support.NestApi.status;
import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.nest.application.NestQueryService;
import com.team.blog.nest.support.NestApi;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import jakarta.servlet.http.Cookie;
import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MvcResult;

/** 둥지 출석·새 크기·상점·장착 (021 US1·US2·US3). */
class NestApiIT extends IntegrationTestBase {

    @Autowired private NestQueryService queries;

    private NestApi api;
    private long me;
    private Cookie session;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        api = new NestApi(mockMvc);
        me = members().member().handle("nestowner1").create();
        session = TestLogin.loginAs(mockMvc, me);
        today = queries.today();
    }

    private MvcResult ok(MvcResult result) {
        assertThat(status(result)).as(body(result)).isEqualTo(200);
        return result;
    }

    private String code(MvcResult result) {
        return read(result, "$.code");
    }

    private int intAt(MvcResult result, String path) {
        return ((Number) read(result, path)).intValue();
    }

    /** 둥지 줄을 직접 맞춘다 (지난 출석 흉내). */
    private void nest(int level, int streak, LocalDate lastAttendedOn) {
        jdbc.update(
                "INSERT INTO nest (member_id, bird_level, streak_days, best_streak_days, last_attended_on)"
                        + " VALUES (?, ?, ?, ?, ?)",
                me,
                level,
                streak,
                streak,
                lastAttendedOn == null ? null : Date.valueOf(lastAttendedOn));
    }

    private void givePoints(int amount) {
        jdbc.update(
                "INSERT INTO nest_point (member_id, reason, amount, source_key, earned_on)"
                        + " VALUES (?, 'ADJUST', ?, ?, ?)",
                me,
                amount,
                "TEST:" + amount,
                Date.valueOf(today));
    }

    @Test
    void 처음_둥지는_아기_새와_기본_숲이고_기본_물건은_가진_것() throws Exception {
        MvcResult result = ok(api.myNest(session));
        assertThat(result.getResponse().getHeader("Cache-Control")).isEqualTo("private, no-store");
        assertThat(intAt(result, "$.nest.level")).isEqualTo(1);
        assertThat((String) read(result, "$.nest.levelName")).isEqualTo("아기 새");
        assertThat((String) read(result, "$.nest.background")).isEqualTo("bg-basic");
        assertThat((String) read(result, "$.nest.border")).isEqualTo("border-none");
        assertThat((List<?>) read(result, "$.nest.decorations")).isEmpty();
        assertThat(intAt(result, "$.balance")).isZero();
        assertThat((Boolean) read(result, "$.attendedToday")).isFalse();
        assertThat(intAt(result, "$.daysToGrow")).isEqualTo(3);
        assertThat((List<?>) read(result, "$.items")).hasSize(14);
        assertThat((List<String>) read(result, "$.items[?(@.owned == true)].code"))
                .containsExactlyInAnyOrder("bg-basic", "border-none");
        assertThat((List<String>) read(result, "$.today[*].reason"))
                .containsExactly("POST", "COMMENT", "LIKE_RECEIVED");
    }

    @Test
    void 출석은_하루_한_번만_포인트를_준다() throws Exception {
        MvcResult first = ok(api.attend(session));
        assertThat((Boolean) read(first, "$.attended")).isTrue();
        assertThat(intAt(first, "$.pointsGained")).isEqualTo(10);
        assertThat(intAt(first, "$.me.balance")).isEqualTo(10);
        assertThat((Boolean) read(first, "$.me.attendedToday")).isTrue();
        assertThat(intAt(first, "$.me.nest.streakDays")).isEqualTo(1);

        MvcResult again = ok(api.attend(session));
        assertThat((Boolean) read(again, "$.attended")).isFalse();
        assertThat(intAt(again, "$.pointsGained")).isZero();
        assertThat(intAt(again, "$.me.balance")).isEqualTo(10);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT count(*) FROM nest_point WHERE member_id = ?",
                                Integer.class,
                                me))
                .isEqualTo(1);
    }

    @Test
    void 연속_3일째에_새가_한_단계_자란다() throws Exception {
        nest(1, 2, today.minusDays(1));
        MvcResult result = ok(api.attend(session));
        assertThat((Boolean) read(result, "$.grew")).isTrue();
        assertThat(intAt(result, "$.me.nest.level")).isEqualTo(2);
        assertThat((String) read(result, "$.me.nest.levelName")).isEqualTo("꼬마 새");
        assertThat(intAt(result, "$.me.nest.streakDays")).isEqualTo(3);
        assertThat(intAt(result, "$.me.bestStreakDays")).isEqualTo(3);
    }

    @Test
    void 연속_7일째에는_보너스_30을_더_준다() throws Exception {
        nest(2, 6, today.minusDays(1));
        MvcResult result = ok(api.attend(session));
        assertThat(intAt(result, "$.pointsGained")).isEqualTo(40);
        MvcResult history = ok(api.points(session, null));
        assertThat((List<String>) read(history, "$.items[*].label"))
                .containsExactly("연속 출석 보너스", "출석");
    }

    @Test
    void 사흘_넘게_빠지면_하루_한_단계씩_작아지고_연속은_끊긴다() throws Exception {
        // 마지막 출석이 6일 전 → 5일 빠짐 → 3일 넘은 2일만큼 작아짐
        nest(4, 9, today.minusDays(6));
        MvcResult seen = ok(api.memberNest("nestowner1"));
        assertThat(intAt(seen, "$.level")).isEqualTo(2);
        assertThat(intAt(seen, "$.streakDays")).isZero();

        MvcResult result = ok(api.attend(session));
        assertThat((Boolean) read(result, "$.grew")).isFalse();
        assertThat(intAt(result, "$.me.nest.level")).isEqualTo(2);
        assertThat(intAt(result, "$.me.nest.streakDays")).isEqualTo(1);
        assertThat(intAt(result, "$.me.bestStreakDays")).isEqualTo(9);
    }

    @Test
    void 사기는_잔액이_값보다_적으면_409_같은_물건은_한_번만() throws Exception {
        MvcResult poor = api.buy(session, "bg-sunset");
        assertThat(status(poor)).isEqualTo(409);
        assertThat(code(poor)).isEqualTo("NEST_POINTS_NOT_ENOUGH");

        givePoints(200);
        MvcResult bought = ok(api.buy(session, "bg-sunset"));
        assertThat(intAt(bought, "$.balance")).isEqualTo(50);
        assertThat((List<Boolean>) read(bought, "$.items[?(@.code == 'bg-sunset')].owned"))
                .containsExactly(true);

        MvcResult twice = api.buy(session, "bg-sunset");
        assertThat(status(twice)).isEqualTo(409);
        assertThat(code(twice)).isEqualTo("NEST_ITEM_ALREADY_OWNED");
        assertThat(code(api.buy(session, "bg-basic"))).isEqualTo("NEST_ITEM_ALREADY_OWNED");

        MvcResult unknown = api.buy(session, "bg-rainbow");
        assertThat(status(unknown)).isEqualTo(400);
        assertThat(code(unknown)).isEqualTo("NEST_ITEM_UNKNOWN");

        MvcResult history = ok(api.points(session, null));
        assertThat((String) read(history, "$.items[0].label")).isEqualTo("물건 사기 · 노을");
        assertThat(intAt(history, "$.items[0].amount")).isEqualTo(-150);
    }

    @Test
    void 장착은_가진_물건만_되고_남도_그_모습을_본다() throws Exception {
        MvcResult notOwned = api.equip(session, "{\"background\":\"bg-night\",\"decorations\":[]}");
        assertThat(status(notOwned)).isEqualTo(400);
        assertThat(code(notOwned)).isEqualTo("NEST_ITEM_NOT_OWNED");

        givePoints(500);
        ok(api.buy(session, "bg-night"));
        ok(api.buy(session, "deco-egg"));
        ok(api.buy(session, "deco-star"));

        MvcResult wrongSlot = api.equip(session, "{\"background\":\"deco-egg\"}");
        assertThat(code(wrongSlot)).isEqualTo("NEST_ITEM_NOT_OWNED");

        ok(
                api.equip(
                        session,
                        "{\"background\":\"bg-night\",\"border\":\"border-none\","
                                + "\"decorations\":[\"deco-egg\",\"deco-star\"]}"));
        MvcResult seen = ok(api.memberNest("nestowner1"));
        assertThat((String) read(seen, "$.background")).isEqualTo("bg-night");
        assertThat((List<String>) read(seen, "$.decorations"))
                .containsExactlyInAnyOrder("deco-egg", "deco-star");

        ok(api.equip(session, "{\"background\":null,\"decorations\":[\"deco-star\"]}"));
        MvcResult after = ok(api.memberNest("nestowner1"));
        assertThat((String) read(after, "$.background")).isEqualTo("bg-basic");
        assertThat((List<String>) read(after, "$.decorations")).containsExactly("deco-star");
    }

    @Test
    void 기록은_새것부터_30개씩() throws Exception {
        for (int i = 1; i <= 31; i++) {
            givePoints(i);
        }
        MvcResult first = ok(api.points(session, null));
        assertThat((List<?>) read(first, "$.items")).hasSize(30);
        assertThat(intAt(first, "$.items[0].amount")).isEqualTo(31);
        Number next = read(first, "$.nextBefore");
        MvcResult second = ok(api.points(session, String.valueOf(next.longValue())));
        assertThat((List<Map<String, Object>>) read(second, "$.items")).hasSize(1);
        assertThat(intAt(second, "$.items[0].amount")).isEqualTo(1);
        assertThat((Object) read(second, "$.nextBefore")).isNull();
    }

    @Test
    void 남의_둥지는_로그인_없이_보고_없는_주소는_404() throws Exception {
        MvcResult seen = ok(api.memberNest("nestowner1"));
        assertThat(intAt(seen, "$.level")).isEqualTo(1);
        assertThat(status(api.memberNest("nobody_here"))).isEqualTo(404);
        assertThat(status(api.myNest(null))).isEqualTo(401);
    }

    @Test
    void 정지된_회원은_출석할_수_없다() throws Exception {
        members().suspend(me, java.time.Instant.now().plusSeconds(86400), "test");
        MvcResult result = api.attend(session);
        assertThat(status(result)).as(body(result)).isEqualTo(403);
    }
}
