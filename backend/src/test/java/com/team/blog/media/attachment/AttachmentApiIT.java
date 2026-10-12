package com.team.blog.media.attachment;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;

import com.team.blog.media.support.ImageApi;
import com.team.blog.support.MinioContainerSupport;
import com.team.blog.support.StorageIntegrationTestBase;
import com.team.blog.support.TestLogin;
import com.team.blog.support.fixture.PostFixtures;
import jakarta.servlet.http.Cookie;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMultipartHttpServletRequestBuilder;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import tools.jackson.databind.JsonNode;

/** 글 첨부파일 API (018 US1~US3, FR-001~FR-012). 저장소는 테스트 MinIO(앱 전용 키 — minio-init.sh와 같은 권한)다. */
class AttachmentApiIT extends StorageIntegrationTestBase {

    private static final byte[] PDF = "%PDF-1.7 첨부 테스트".getBytes(StandardCharsets.UTF_8);

    @Autowired private AttachmentCleanupJob cleanupJob;

    private PostFixtures posts;

    @BeforeEach
    void setUp() {
        posts = new PostFixtures(jdbc);
    }

    // ------------------------------------------------------------------ helpers

    private MvcResult upload(Cookie session, long postId, String name, byte[] bytes)
            throws Exception {
        String token = UUID.randomUUID().toString();
        MockMultipartHttpServletRequestBuilder request =
                multipart("/api/posts/{postId}/attachments", postId)
                        .file(new MockMultipartFile("file", name, "application/pdf", bytes));
        request.cookie(new Cookie("XSRF-TOKEN", token)).header("X-XSRF-TOKEN", token);
        if (session != null) {
            request.cookie(session);
        }
        return mockMvc.perform(request).andReturn();
    }

    private MvcResult list(Cookie session, long postId) throws Exception {
        MockHttpServletRequestBuilder request = get("/api/posts/{postId}/attachments", postId);
        if (session != null) {
            request.cookie(session);
        }
        return mockMvc.perform(request).andReturn();
    }

    private MvcResult download(Cookie session, String url) throws Exception {
        MockHttpServletRequestBuilder request = get(url);
        if (session != null) {
            request.cookie(session);
        }
        return mockMvc.perform(request).andReturn();
    }

    private static JsonNode json(MvcResult result) {
        return ImageApi.json(result);
    }

    private String errorCode(MvcResult result) throws Exception {
        JsonNode body = json(result);
        JsonNode errors = body.path("errors");
        return errors.isArray() && !errors.isEmpty()
                ? errors.get(0).path("code").asString()
                : body.path("code").asString();
    }

    private String keyOf(long attachmentId) {
        return jdbc.queryForObject(
                "SELECT storage_key FROM post_attachment WHERE id = ?", String.class, attachmentId);
    }

    private boolean stored(String key) {
        try {
            MinioContainerSupport.admin()
                    .headObject(b -> b.bucket(MinioContainerSupport.BUCKET).key(key));
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (software.amazon.awssdk.services.s3.model.S3Exception e) {
            if (e.statusCode() == 404) {
                return false;
            }
            throw e;
        }
    }

    // ------------------------------------------------------------------ US1 올리기·내려받기

    @Test
    void 글_주인이_올린_파일은_목록에_나오고_원래_이름_그대로_내려받는다() throws Exception {
        long me = members().member().create();
        long post = posts.create(me, PostFixtures.State.PUBLISHED_PUBLIC);
        Cookie session = TestLogin.loginAs(mockMvc, me);

        MvcResult uploaded = upload(session, post, "발표 자료.pdf", PDF);

        assertThat(uploaded.getResponse().getStatus()).isEqualTo(201);
        JsonNode body = json(uploaded);
        long id = body.path("id").asLong();
        assertThat(body.path("name").asString()).isEqualTo("발표 자료.pdf");
        assertThat(body.path("size").asLong()).isEqualTo(PDF.length);
        String url = body.path("downloadUrl").asString();
        assertThat(url).isEqualTo("/api/posts/" + post + "/attachments/" + id + "/download");
        assertThat(body.has("storageKey")).isFalse();
        String key = keyOf(id);
        assertThat(key).startsWith("attachments/").doesNotContain("발표").doesNotContain(".pdf");
        assertThat(stored(key)).isTrue();

        JsonNode items = json(list(null, post)).path("items");
        assertThat(items).hasSize(1);
        assertThat(items.get(0).path("name").asString()).isEqualTo("발표 자료.pdf");

        MvcResult file = download(null, url);
        assertThat(file.getResponse().getStatus()).isEqualTo(200);
        assertThat(file.getResponse().getContentAsByteArray()).isEqualTo(PDF);
        assertThat(file.getResponse().getContentType()).isEqualTo("application/octet-stream");
        assertThat(file.getResponse().getHeader("Content-Disposition"))
                .startsWith("attachment;")
                .contains("filename*=UTF-8''%EB%B0%9C%ED%91%9C%20%EC%9E%90%EB%A3%8C.pdf");
        assertThat(file.getResponse().getHeader("Cache-Control")).contains("no-store");
        assertThat(file.getResponse().getHeader("X-Content-Type-Options")).isEqualTo("nosniff");
    }

    @Test
    void 저장소의_첨부파일은_익명으로_바로_열리지_않는다() throws Exception {
        long me = members().member().create();
        long post = posts.create(me, PostFixtures.State.PUBLISHED_PUBLIC);
        long id =
                json(upload(TestLogin.loginAs(mockMvc, me), post, "a.pdf", PDF))
                        .path("id")
                        .asLong();

        java.net.http.HttpResponse<Void> response =
                java.net.http.HttpClient.newHttpClient()
                        .send(
                                java.net.http.HttpRequest.newBuilder(
                                                java.net.URI.create(
                                                        MinioContainerSupport.publicBaseUrl()
                                                                + "/"
                                                                + keyOf(id)))
                                        .GET()
                                        .build(),
                                java.net.http.HttpResponse.BodyHandlers.discarding());
        assertThat(response.statusCode()).isEqualTo(403);
    }

    @Test
    void 경로가_섞인_이름은_마지막_이름만_남긴다() throws Exception {
        long me = members().member().create();
        long post = posts.create(me, PostFixtures.State.DRAFT);

        MvcResult result = upload(TestLogin.loginAs(mockMvc, me), post, "../../etc/보고서.docx", PDF);

        assertThat(result.getResponse().getStatus()).isEqualTo(201);
        assertThat(json(result).path("name").asString()).isEqualTo("보고서.docx");
    }

    // ------------------------------------------------------------------ 거부

    @Test
    void 받지_않는_형식_빈_파일_10MB_초과는_400이고_저장소에_남지_않는다() throws Exception {
        long me = members().member().create();
        long post = posts.create(me, PostFixtures.State.DRAFT);
        Cookie session = TestLogin.loginAs(mockMvc, me);

        for (String name : List.of("setup.exe", "page.html", "run.sh", "image.svg", "README")) {
            MvcResult result = upload(session, post, name, PDF);
            assertThat(result.getResponse().getStatus()).as(name).isEqualTo(400);
            assertThat(errorCode(result)).as(name).isEqualTo("ATTACHMENT_TYPE_NOT_ALLOWED");
        }

        MvcResult empty = upload(session, post, "empty.pdf", new byte[0]);
        assertThat(empty.getResponse().getStatus()).isEqualTo(400);
        assertThat(errorCode(empty)).isEqualTo("ATTACHMENT_EMPTY");

        byte[] big = new byte[10_485_761];
        Arrays.fill(big, (byte) 'a');
        MvcResult tooBig = upload(session, post, "big.zip", big);
        assertThat(tooBig.getResponse().getStatus()).isEqualTo(400);
        assertThat(errorCode(tooBig)).isEqualTo("ATTACHMENT_TOO_LARGE");

        assertThat(jdbc.queryForObject("SELECT count(*) FROM post_attachment", Integer.class))
                .isZero();
    }

    @Test
    void 한_글에_5개까지_6번째는_409() throws Exception {
        long me = members().member().create();
        long post = posts.create(me, PostFixtures.State.DRAFT);
        Cookie session = TestLogin.loginAs(mockMvc, me);
        for (int i = 1; i <= 5; i++) {
            assertThat(upload(session, post, "f" + i + ".txt", PDF).getResponse().getStatus())
                    .isEqualTo(201);
        }

        MvcResult sixth = upload(session, post, "f6.txt", PDF);

        assertThat(sixth.getResponse().getStatus()).isEqualTo(409);
        assertThat(errorCode(sixth)).isEqualTo("ATTACHMENT_LIMIT_EXCEEDED");
        assertThat(json(sixth).path("details").path("maxPerPost").asInt()).isEqualTo(5);
        assertThat(json(list(session, post)).path("items")).hasSize(5);
    }

    @Test
    void 비회원_401_남의_글_404_인증_전_403() throws Exception {
        long owner = members().member().create();
        long post = posts.create(owner, PostFixtures.State.PUBLISHED_PUBLIC);

        assertThat(upload(null, post, "a.pdf", PDF).getResponse().getStatus()).isEqualTo(401);

        long other = members().member().create();
        MvcResult notMine = upload(TestLogin.loginAs(mockMvc, other), post, "a.pdf", PDF);
        assertThat(notMine.getResponse().getStatus()).isEqualTo(404);

        long unverified = members().member().emailVerified(false).create();
        long unverifiedPost = posts.create(unverified, PostFixtures.State.DRAFT);
        MvcResult blocked =
                upload(TestLogin.loginAs(mockMvc, unverified), unverifiedPost, "a.pdf", PDF);
        assertThat(blocked.getResponse().getStatus()).isEqualTo(403);
        assertThat(errorCode(blocked)).isEqualTo("EMAIL_NOT_VERIFIED");
    }

    // ------------------------------------------------------------------ US2 볼 수 있는 사람만

    @Test
    void 비공개_글_임시글의_첨부는_글_주인만_보고_받는다() throws Exception {
        long owner = members().member().create();
        long other = members().member().create();
        Cookie ownerSession = TestLogin.loginAs(mockMvc, owner);
        Cookie otherSession = TestLogin.loginAs(mockMvc, other);

        for (PostFixtures.State state :
                List.of(
                        PostFixtures.State.PUBLISHED_PRIVATE,
                        PostFixtures.State.DRAFT,
                        PostFixtures.State.HIDDEN)) {
            long post = posts.create(owner, state);
            String url =
                    json(upload(ownerSession, post, "a.pdf", PDF)).path("downloadUrl").asString();

            assertThat(list(ownerSession, post).getResponse().getStatus())
                    .as(state.name())
                    .isEqualTo(200);
            assertThat(download(ownerSession, url).getResponse().getStatus())
                    .as(state.name())
                    .isEqualTo(200);
            assertThat(list(null, post).getResponse().getStatus()).as(state.name()).isEqualTo(404);
            assertThat(list(otherSession, post).getResponse().getStatus())
                    .as(state.name())
                    .isEqualTo(404);
            assertThat(download(null, url).getResponse().getStatus())
                    .as(state.name())
                    .isEqualTo(404);
            assertThat(download(otherSession, url).getResponse().getStatus())
                    .as(state.name())
                    .isEqualTo(404);
        }
    }

    @Test
    void 다른_글_번호로_첨부를_받을_수_없다() throws Exception {
        long me = members().member().create();
        long a = posts.create(me, PostFixtures.State.PUBLISHED_PUBLIC);
        long b = posts.create(me, PostFixtures.State.PUBLISHED_PUBLIC);
        long id = json(upload(TestLogin.loginAs(mockMvc, me), a, "a.pdf", PDF)).path("id").asLong();

        assertThat(
                        download(null, "/api/posts/" + b + "/attachments/" + id + "/download")
                                .getResponse()
                                .getStatus())
                .isEqualTo(404);
    }

    // ------------------------------------------------------------------ US3 지우기·정리

    @Test
    void 글_주인이_지우면_목록과_저장소에서_사라지고_남은_지울_목록이_없다() throws Exception {
        long me = members().member().create();
        long post = posts.create(me, PostFixtures.State.PUBLISHED_PUBLIC);
        Cookie session = TestLogin.loginAs(mockMvc, me);
        long id = json(upload(session, post, "a.pdf", PDF)).path("id").asLong();
        String key = keyOf(id);

        long other = members().member().create();
        MvcResult notMine =
                mockMvc.perform(
                                TestLogin.withCsrf(
                                        delete("/api/posts/{p}/attachments/{a}", post, id),
                                        TestLogin.loginAs(mockMvc, other)))
                        .andReturn();
        assertThat(notMine.getResponse().getStatus()).isEqualTo(404);

        MvcResult deleted =
                mockMvc.perform(
                                TestLogin.withCsrf(
                                        delete("/api/posts/{p}/attachments/{a}", post, id),
                                        session))
                        .andReturn();

        assertThat(deleted.getResponse().getStatus()).isEqualTo(204);
        assertThat(json(list(session, post)).path("items")).isEmpty();
        assertThat(stored(key)).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM attachment_trash", Integer.class))
                .isZero();
    }

    @Test
    void 글이_완전히_지워지면_정리_작업이_파일을_지운다() throws Exception {
        long me = members().member().create();
        long post = posts.create(me, PostFixtures.State.DRAFT);
        long id =
                json(upload(TestLogin.loginAs(mockMvc, me), post, "a.pdf", PDF))
                        .path("id")
                        .asLong();
        String key = keyOf(id);

        jdbc.update("DELETE FROM post WHERE id = ?", post);

        assertThat(jdbc.queryForList("SELECT storage_key FROM attachment_trash", String.class))
                .containsExactly(key);
        assertThat(stored(key)).isTrue();

        assertThat(cleanupJob.cleanup()).isEqualTo(1);

        assertThat(stored(key)).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM attachment_trash", Integer.class))
                .isZero();
    }
}
