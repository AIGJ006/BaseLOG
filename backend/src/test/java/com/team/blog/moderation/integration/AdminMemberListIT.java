package com.team.blog.moderation.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.jayway.jsonpath.JsonPath;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletResponse;

/** 관리자 회원 목록 {@code GET /api/admin/members?q&status&page}. */
class AdminMemberListIT extends IntegrationTestBase {

    private Cookie admin;

    @BeforeEach
    void setUp() {
        admin =
                TestLogin.loginAs(
                        mockMvc,
                        members()
                                .member()
                                .role("ADMIN")
                                .handle("admin001")
                                .nickname("관리자")
                                .email("boss@example.com")
                                .create());
    }

    private MockHttpServletResponse list(String query) throws Exception {
        return mockMvc.perform(TestLogin.withCsrf(get("/api/admin/members" + query), admin))
                .andReturn()
                .getResponse();
    }

    /** 검색어는 그대로 넘긴다(퍼센트 인코딩은 MockMvc가 한다). */
    private MockHttpServletResponse search(String keyword) throws Exception {
        return mockMvc.perform(
                        TestLogin.withCsrf(get("/api/admin/members").param("q", keyword), admin))
                .andReturn()
                .getResponse();
    }

    private static String body(MockHttpServletResponse r) throws Exception {
        return r.getContentAsString(StandardCharsets.UTF_8);
    }

    private static List<String> handles(MockHttpServletResponse r) throws Exception {
        return JsonPath.read(body(r), "$.items[*].handle");
    }

    @Test
    void 가입_최근_순으로_이메일_로그인_방식과_함께_보여_주고_익명_처리된_회원은_뺀다() throws Exception {
        long kim =
                members()
                        .member()
                        .handle("kim001")
                        .nickname("김민서")
                        .email("Kim@Example.com")
                        .create();
        members().member().provider("GITHUB").handle("gi-octo").nickname("옥토").email(null).create();
        members().member().handle("gone01").status("WITHDRAWN").deleted().create();
        members().member().handle("bye001").nickname("탈퇴중").status("WITHDRAWN").create();
        jdbc.update(
                "UPDATE auth_identity SET last_login_at = ? WHERE member_id = ?",
                Timestamp.from(Instant.parse("2026-10-01T00:00:00Z")),
                kim);

        MockHttpServletResponse r = list("");

        assertThat(r.getStatus()).isEqualTo(200);
        assertThat(r.getHeader("Cache-Control")).isEqualTo("private, no-store");
        assertThat(handles(r)).containsExactly("bye001", "gi-octo", "kim001", "admin001");
        String json = body(r);
        assertThat((Integer) JsonPath.read(json, "$.total")).isEqualTo(4);
        assertThat((Integer) JsonPath.read(json, "$.page")).isEqualTo(1);
        assertThat((Integer) JsonPath.read(json, "$.size")).isEqualTo(20);
        assertThat((Integer) JsonPath.read(json, "$.totalPages")).isEqualTo(1);
        assertThat((String) JsonPath.read(json, "$.items[2].email")).isEqualTo("kim@example.com");
        assertThat((String) JsonPath.read(json, "$.items[2].provider")).isEqualTo("LOCAL");
        assertThat((String) JsonPath.read(json, "$.items[2].lastLoginAt"))
                .isEqualTo("2026-10-01T00:00:00Z");
        assertThat((Object) JsonPath.read(json, "$.items[1].email")).isNull();
        assertThat((String) JsonPath.read(json, "$.items[1].provider")).isEqualTo("GITHUB");
        assertThat((String) JsonPath.read(json, "$.items[0].status")).isEqualTo("WITHDRAWN");
        assertThat((String) JsonPath.read(json, "$.items[3].role")).isEqualTo("ADMIN");
        assertThat(json).doesNotContain("password").doesNotContain("\"id\"");
    }

    @Test
    void 주소_닉네임_이메일로_찾고_상태로_거른다() throws Exception {
        members().member().handle("kim001").nickname("김민서").email("hello@naver.com").create();
        members().member().handle("lee001").nickname("이영희").email("lee@example.com").create();
        members().member().handle("park01").nickname("박철수").status("SUSPENDED").create();

        assertThat(handles(list("?q=KIM"))).containsExactly("kim001");
        assertThat(handles(search("영희"))).containsExactly("lee001");
        assertThat(handles(list("?q=naver"))).containsExactly("kim001");
        assertThat(handles(search("  "))).hasSize(4);
        assertThat(handles(list("?status=SUSPENDED"))).containsExactly("park01");
        assertThat(handles(list("?q=lee&status=SUSPENDED"))).isEmpty();
    }

    @Test
    void 검색어의_퍼센트와_밑줄은_글자_그대로_찾는다() throws Exception {
        members().member().handle("a_b001").nickname("밑줄").create();
        members().member().handle("axb001").nickname("엑스").create();

        assertThat(handles(search("a_b"))).containsExactly("a_b001");
        assertThat(handles(search("%"))).isEmpty();
    }

    @Test
    void 스무_명씩_나누고_마지막_쪽을_넘으면_빈_목록() throws Exception {
        for (int i = 0; i < 21; i++) {
            members().member().create();
        }

        MockHttpServletResponse first = list("?page=1");
        MockHttpServletResponse second = list("?page=2");
        MockHttpServletResponse beyond = list("?page=3");

        assertThat(handles(first)).hasSize(20);
        assertThat((Integer) JsonPath.read(body(first), "$.total")).isEqualTo(22);
        assertThat((Integer) JsonPath.read(body(first), "$.totalPages")).isEqualTo(2);
        assertThat(handles(second)).hasSize(2).last().isEqualTo("admin001");
        assertThat(handles(beyond)).isEmpty();
        assertThat((Integer) JsonPath.read(body(beyond), "$.page")).isEqualTo(3);
    }

    @Test
    void 형식이_틀리면_400() throws Exception {
        MockHttpServletResponse badStatus = list("?status=BANNED");
        MockHttpServletResponse badPage = list("?page=0");
        MockHttpServletResponse notNumber = list("?page=abc");
        MockHttpServletResponse tooLong = search("가".repeat(101));

        assertThat(badStatus.getStatus()).isEqualTo(400);
        assertThat(body(badStatus)).contains("\"field\":\"status\"");
        assertThat(badPage.getStatus()).isEqualTo(400);
        assertThat(body(badPage)).contains("\"field\":\"page\"");
        assertThat(notNumber.getStatus()).isEqualTo(400);
        assertThat(tooLong.getStatus()).isEqualTo(400);
        assertThat(body(tooLong)).contains("\"code\":\"TOO_LONG\"");
        assertThat(search("가".repeat(100)).getStatus()).isEqualTo(200);
    }
}
