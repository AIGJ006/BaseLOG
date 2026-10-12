package com.team.blog.post.integration;

import static com.team.blog.post.support.EditorApi.publishBody;
import static com.team.blog.post.support.EditorApi.read;
import static com.team.blog.post.support.EditorApi.status;
import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.post.support.EditorApi;
import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.TestLogin;
import jakarta.servlet.http.Cookie;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/** 019 글 썸네일 지정: 고른 값만 저장, 본문 밖 사진도 연결, 남의 사진은 400, 에디터 열기에 원본 주소. */
class PostThumbnailIT extends IntegrationTestBase {

    /** application.yml 기본 {@code blog.image.public-base-url}. */
    private static final String BASE = "http://localhost:9000/blog";

    private static final String KEY_A = "images/2026/10/3e9b4c8f-5d6a-4c0b-8f4d-8ab1c9d4e5f6.webp";
    private static final String THUMB_A =
            "images/2026/10/3e9b4c8f-5d6a-4c0b-8f4d-8ab1c9d4e5f6_thumb.webp";
    private static final String KEY_B = "images/2026/10/4fac5d9a-6e7b-4d1c-9a5e-9bc2dae5f607.webp";
    private static final String KEY_OTHER =
            "images/2026/10/5abd6eab-7f8c-4e2d-8b6f-acd3ebf60718.webp";

    private EditorApi api() {
        return new EditorApi(mockMvc);
    }

    private long image(long uploader, String key, String thumb) {
        return jdbc.queryForObject(
                "INSERT INTO image (uploader_id, storage_key, thumb_storage_key, content_type,"
                        + " size_bytes, width, height) VALUES (?, ?, ?, 'image/webp', 1000, 640, 480) RETURNING id",
                Long.class,
                uploader,
                key,
                thumb);
    }

    private String thumbnailOf(long postId) {
        return jdbc.queryForObject(
                "SELECT thumbnail_url FROM post WHERE id = ?", String.class, postId);
    }

    private static Map<String, Object> body(String md, long base, String thumbnailUrl) {
        Map<String, Object> body = publishBody("제목", md, List.of(), "PUBLIC", base);
        body.put("thumbnailUrl", thumbnailUrl);
        return body;
    }

    @Test
    void 고른_본문_사진의_썸네일_주소를_저장하고_에디터에는_원본_주소로_돌려준다() throws Exception {
        long me = members().member().create();
        image(me, KEY_A, THUMB_A);
        image(me, KEY_B, null);
        Cookie session = TestLogin.loginAs(mockMvc, me);
        long postId = api().createPostId(session);
        String md = "![b](" + BASE + "/" + KEY_B + ")\n\n![a](" + BASE + "/" + KEY_A + ")";

        assertThat(status(api().publish(session, postId, body(md, 0, BASE + "/" + KEY_A))))
                .isEqualTo(200);

        assertThat(thumbnailOf(postId)).isEqualTo(BASE + "/" + THUMB_A);
        MvcResult opened = api().workingCopy(session, postId);
        assertThat((String) read(opened, "$.thumbnailUrl")).isEqualTo(BASE + "/" + KEY_A);
    }

    @Test
    void 썸네일이_없는_사진은_원본_주소를_저장하고_지우면_지정_없음() throws Exception {
        long me = members().member().create();
        image(me, KEY_B, null);
        Cookie session = TestLogin.loginAs(mockMvc, me);
        long postId = api().createPostId(session);
        String md = "![b](" + BASE + "/" + KEY_B + ")";

        api().publish(session, postId, body(md, 0, BASE + "/" + KEY_B));
        assertThat(thumbnailOf(postId)).isEqualTo(BASE + "/" + KEY_B);

        assertThat(status(api().publish(session, postId, body(md, 1, null)))).isEqualTo(200);
        assertThat(thumbnailOf(postId)).isNull();
        MvcResult opened = api().workingCopy(session, postId);
        assertThat((Object) read(opened, "$.thumbnailUrl")).isNull();
    }

    @Test
    void 본문에_없는_내_사진을_골라도_글에_연결한다() throws Exception {
        long me = members().member().create();
        long imageA = image(me, KEY_A, THUMB_A);
        Cookie session = TestLogin.loginAs(mockMvc, me);
        long postId = api().createPostId(session);

        assertThat(status(api().publish(session, postId, body("사진 없는 본문", 0, BASE + "/" + KEY_A))))
                .isEqualTo(200);

        assertThat(thumbnailOf(postId)).isEqualTo(BASE + "/" + THUMB_A);
        assertThat(
                        jdbc.queryForList(
                                "SELECT image_id FROM post_image WHERE post_id = ?",
                                Long.class,
                                postId))
                .containsExactly(imageA);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM image WHERE id = ?", String.class, imageA))
                .isEqualTo("ATTACHED");
    }

    @Test
    void 남의_사진이나_모르는_주소는_400_INVALID_THUMBNAIL이고_글은_그대로() throws Exception {
        long me = members().member().create();
        long other = members().member().create();
        image(other, KEY_OTHER, null);
        Cookie session = TestLogin.loginAs(mockMvc, me);
        long postId = api().createPostId(session);

        for (String url : List.of(BASE + "/" + KEY_OTHER, "https://example.com/cat.png")) {
            MvcResult result = api().publish(session, postId, body("본문", 0, url));
            assertThat(status(result)).isEqualTo(400);
            assertThat((String) read(result, "$.code")).isEqualTo("VALIDATION_FAILED");
            assertThat((String) read(result, "$.errors[0].field")).isEqualTo("thumbnailUrl");
            assertThat((String) read(result, "$.errors[0].code")).isEqualTo("INVALID_THUMBNAIL");
        }
        assertThat(
                        jdbc.queryForObject(
                                "SELECT status FROM post WHERE id = ?", String.class, postId))
                .isEqualTo("DRAFT");
    }

    @Test
    void 빈_문자열은_지정_없음() throws Exception {
        long me = members().member().create();
        Cookie session = TestLogin.loginAs(mockMvc, me);
        long postId = api().createPostId(session);

        assertThat(status(api().publish(session, postId, body("본문", 0, "  ")))).isEqualTo(200);
        assertThat(thumbnailOf(postId)).isNull();
    }
}
