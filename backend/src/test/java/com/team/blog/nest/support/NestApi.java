package com.team.blog.nest.support;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

import com.jayway.jsonpath.JsonPath;
import com.team.blog.support.TestLogin;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** 021 둥지 API 호출 도우미 (테스트 전용). 상태를 바꾸는 요청에는 CSRF 쿠키·헤더를 붙인다. */
public final class NestApi {

    private final MockMvc mockMvc;

    public NestApi(MockMvc mockMvc) {
        this.mockMvc = mockMvc;
    }

    public MvcResult myNest(Cookie session) throws Exception {
        return perform(get("/api/me/nest"), session);
    }

    public MvcResult attend(Cookie session) throws Exception {
        return send(post("/api/me/nest/attendance"), session, "{}");
    }

    public MvcResult points(Cookie session, String before) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/me/nest/points");
        if (before != null) {
            request.param("before", before);
        }
        return perform(request, session);
    }

    public MvcResult buy(Cookie session, String code) throws Exception {
        return send(post("/api/me/nest/items/{code}", code), session, "{}");
    }

    public MvcResult equip(Cookie session, String json) throws Exception {
        return send(put("/api/me/nest/equipped"), session, json);
    }

    public MvcResult showOnBlog(Cookie session, boolean show) throws Exception {
        return showOnBlog(session, "{\"show\":" + show + "}");
    }

    public MvcResult showOnBlog(Cookie session, String json) throws Exception {
        return send(put("/api/me/nest/show-on-blog"), session, json);
    }

    public MvcResult devLevel(Cookie session, int level) throws Exception {
        return send(put("/api/me/nest/dev/level"), session, "{\"level\":" + level + "}");
    }

    public MvcResult memberNest(String handle) throws Exception {
        return perform(get("/api/members/{handle}/nest", handle), null);
    }

    public MvcResult like(Cookie session, long postId) throws Exception {
        return send(put("/api/posts/{postId}/like", postId), session, "{}");
    }

    private MvcResult send(MockHttpServletRequestBuilder request, Cookie session, String json)
            throws Exception {
        return mockMvc.perform(
                        TestLogin.withCsrf(request, session)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(json))
                .andReturn();
    }

    private MvcResult perform(MockHttpServletRequestBuilder request, Cookie session)
            throws Exception {
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
