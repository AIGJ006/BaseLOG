package com.team.blog.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 친구·피드·블로그 머리말(020) API 호출 도우미 (테스트 전용). 상태를 바꾸는 요청에는 CSRF 쿠키·헤더를 붙인다. */
public final class FriendApi {

    private final MockMvc mockMvc;

    public FriendApi(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    /** 친구 요청 / 받은 요청 수락. */
    public MvcResult request(Cookie session, String handle) throws Exception {
        return mockMvc.perform(TestLogin.withCsrf(put("/api/members/{h}/friend", handle), session))
                .andReturn();
    }

    /** 거절 / 요청 취소 / 친구 끊기. */
    public MvcResult remove(Cookie session, String handle) throws Exception {
        return mockMvc.perform(
                        TestLogin.withCsrf(delete("/api/members/{h}/friend", handle), session))
                .andReturn();
    }

    public MvcResult feed(Cookie session, String cursor) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/feed");
        if (cursor != null) {
            request.param("cursor", cursor);
        }
        if (session != null) {
            request.cookie(session);
        }
        return mockMvc.perform(request).andReturn();
    }

    public MvcResult header(Cookie session, String handle) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/members/{h}", handle);
        if (session != null) {
            request.cookie(session);
        }
        return mockMvc.perform(request).andReturn();
    }

    public static int status(MvcResult result) {
        return result.getResponse().getStatus();
    }

    public static String body(MvcResult result) {
        return new String(result.getResponse().getContentAsByteArray(), StandardCharsets.UTF_8);
    }

    public static <T> T read(MvcResult result, String jsonPath) {
        return JsonPath.read(body(result), jsonPath);
    }
}
