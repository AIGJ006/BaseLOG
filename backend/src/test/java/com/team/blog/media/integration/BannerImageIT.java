package com.team.blog.media.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;

import com.team.blog.media.application.BannerImageService;
import com.team.blog.media.application.ImagePurgeService;
import com.team.blog.media.support.ImageApi;
import com.team.blog.support.MinioContainerSupport;
import com.team.blog.support.StorageIntegrationTestBase;
import com.team.blog.support.TestLogin;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;

/**
 * 둥지 배너 (025): BANNER presign·complete(정확히 1500×600) 뒤 {@code PATCH /api/me/profile
 * {bannerImageId}}가 {@link BannerImageService#attach}를 부르고, 내 프로필·둥지 머리말이 {@code bannerImageUrl}을
 * 돌려준다. 탈퇴 정리는 다른 사진과 함께 배너도 떼어 둔다. 배너 사진이 없을 때 칠할 {@code bannerColor}도 여기서 본다.
 */
class BannerImageIT extends StorageIntegrationTestBase {

    @Autowired BannerImageService banners;
    @Autowired ImagePurgeService purge;
    @Autowired TransactionTemplate tx;

    private ImageApi api;
    private long me;
    private Cookie session;

    @BeforeEach
    void setUp() {
        api = new ImageApi(mockMvc);
        me = members().member().handle("banner_owner").create();
        session = TestLogin.loginAs(mockMvc, me);
    }

    private long upload(String fixture) throws Exception {
        byte[] bytes = ImageCompleteIT.fixture(fixture);
        MvcResult presign = api.presign(session, ImageApi.bannerBody("image/webp", bytes.length));
        assertThat(presign.getResponse().getStatus())
                .as(presign.getResponse().getContentAsString())
                .isEqualTo(201);
        JsonNode json = ImageApi.json(presign);
        assertThat(json.path("thumbUpload").isNull()).isTrue();
        long id = json.path("imageId").asLong();
        String key =
                jdbc.queryForObject("SELECT storage_key FROM image WHERE id = ?", String.class, id);
        MinioContainerSupport.putDirect(key, "image/webp", bytes);
        return id;
    }

    private MvcResult setBanner(Long imageId) throws Exception {
        return mockMvc.perform(
                        TestLogin.withCsrf(patch("/api/me/profile"), session)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"bannerImageId\":" + imageId + "}"))
                .andReturn();
    }

    private long currentCount() {
        return jdbc.queryForObject(
                "SELECT count(*) FROM image WHERE uploader_id = ? AND purpose = 'BANNER'"
                        + " AND status = 'ATTACHED' AND detached_at IS NULL",
                Long.class,
                me);
    }

    private static void assertFieldError(MvcResult result, String field, String code)
            throws Exception {
        assertThat(result.getResponse().getStatus())
                .as(result.getResponse().getContentAsString())
                .isEqualTo(400);
        JsonNode body = ImageApi.json(result);
        assertThat(body.path("code").asString()).isEqualTo("VALIDATION_FAILED");
        assertThat(body.path("errors").valueStream())
                .anySatisfy(
                        e -> {
                            assertThat(e.path("field").asString()).isEqualTo(field);
                            assertThat(e.path("code").asString()).isEqualTo(code);
                        });
    }

    @Test
    void presign은_WebP_JPEG_2MB_이하만_받고_썸네일_칸은_받지_않는다() throws Exception {
        assertFieldError(
                api.presign(session, ImageApi.bannerBody("image/png", 1000)),
                "contentType",
                "UNSUPPORTED_IMAGE_TYPE");
        assertFieldError(
                api.presign(session, ImageApi.bannerBody("image/webp", 2_097_153)),
                "size",
                "IMAGE_TOO_LARGE");
        assertFieldError(
                api.presign(
                        session,
                        "{\"purpose\":\"BANNER\",\"contentType\":\"image/jpeg\",\"size\":1000,"
                                + "\"thumbContentType\":\"image/webp\",\"thumbSize\":100}"),
                "thumbContentType",
                "THUMBNAIL_NOT_ALLOWED");
        assertThat(
                        api.presign(session, ImageApi.bannerBody("image/jpeg", 2_097_152))
                                .getResponse()
                                .getStatus())
                .isEqualTo(201);
    }

    @Test
    void complete는_정확히_1500x600만_통과하고_예전_1500x375는_막는다() throws Exception {
        long ok = upload("banner-1500x600.webp");
        MvcResult done = api.complete(session, ok);
        assertThat(done.getResponse().getStatus()).isEqualTo(200);
        assertThat(ImageApi.json(done).path("width").asInt()).isEqualTo(1500);
        assertThat(ImageApi.json(done).path("height").asInt()).isEqualTo(600);

        long wrong = upload("banner-1500x375.webp");
        MvcResult rejected = api.complete(session, wrong);
        assertThat(rejected.getResponse().getStatus()).isEqualTo(400);
        assertThat(ImageApi.json(rejected).path("details").path("reason").asString())
                .isEqualTo("BANNER_SIZE_INVALID");
    }

    @Test
    void 붙이면_내_프로필과_둥지_머리말에_주소가_나오고_바꾸면_이전_배너를_뗀다() throws Exception {
        long first = upload("banner-1500x600.webp");
        api.complete(session, first);
        long second = upload("banner-1500x600.webp");
        api.complete(session, second);

        MvcResult saved = setBanner(first);
        assertThat(saved.getResponse().getStatus())
                .as(saved.getResponse().getContentAsString())
                .isEqualTo(200);
        assertThat(ImageApi.json(saved).path("bannerImageId").asLong()).isEqualTo(first);
        assertThat(ImageApi.json(saved).path("bannerImageUrl").asString()).startsWith("http");

        assertThat(setBanner(second).getResponse().getStatus()).isEqualTo(200);
        assertThat(banners.currentImageId(me)).contains(second);
        assertThat(currentCount()).isOne();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT detached_at IS NOT NULL FROM image WHERE id = ?",
                                Boolean.class,
                                first))
                .isTrue();

        String key =
                jdbc.queryForObject(
                        "SELECT storage_key FROM image WHERE id = ?", String.class, second);
        JsonNode profile =
                ImageApi.json(mockMvc.perform(get("/api/me/profile").cookie(session)).andReturn());
        assertThat(profile.path("bannerImageId").asLong()).isEqualTo(second);
        assertThat(profile.path("bannerImageUrl").asString()).endsWith(key);
        JsonNode header =
                ImageApi.json(mockMvc.perform(get("/api/members/banner_owner")).andReturn());
        assertThat(header.path("bannerImageUrl").asString()).endsWith(key);
    }

    @Test
    void null이면_기본_배경으로_돌아간다() throws Exception {
        long id = upload("banner-1500x600.webp");
        api.complete(session, id);
        setBanner(id);

        MvcResult cleared = setBanner(null);
        assertThat(cleared.getResponse().getStatus()).isEqualTo(200);
        assertThat(ImageApi.json(cleared).path("bannerImageId").isNull()).isTrue();
        assertThat(ImageApi.json(cleared).path("bannerImageUrl").isNull()).isTrue();
        assertThat(currentCount()).isZero();
        JsonNode header =
                ImageApi.json(mockMvc.perform(get("/api/members/banner_owner")).andReturn());
        assertThat(header.path("bannerImageUrl").isNull()).isTrue();
    }

    private MvcResult setColor(String json) throws Exception {
        return mockMvc.perform(
                        TestLogin.withCsrf(patch("/api/me/profile"), session)
                                .contentType(MediaType.APPLICATION_JSON)
                                .content("{\"bannerColor\":" + json + "}"))
                .andReturn();
    }

    @Test
    void 배너_색은_소문자로_저장해_내_프로필과_둥지_머리말에_나오고_null이면_기본으로() throws Exception {
        MvcResult saved = setColor("\"#6AFF1E\"");
        assertThat(saved.getResponse().getStatus())
                .as(saved.getResponse().getContentAsString())
                .isEqualTo(200);
        assertThat(ImageApi.json(saved).path("bannerColor").asString()).isEqualTo("#6aff1e");
        JsonNode header =
                ImageApi.json(mockMvc.perform(get("/api/members/banner_owner")).andReturn());
        assertThat(header.path("bannerColor").asString()).isEqualTo("#6aff1e");

        assertFieldError(setColor("\"red\""), "bannerColor", "INVALID_BANNER_COLOR");
        assertFieldError(setColor("\"#12345\""), "bannerColor", "INVALID_BANNER_COLOR");

        assertThat(setColor("null").getResponse().getStatus()).isEqualTo(200);
        assertThat(
                        jdbc.queryForObject(
                                "SELECT banner_color FROM member WHERE id = ?", String.class, me))
                .isNull();
        JsonNode cleared =
                ImageApi.json(mockMvc.perform(get("/api/members/banner_owner")).andReturn());
        assertThat(cleared.path("bannerColor").isNull()).isTrue();
    }

    @Test
    void 완료_전_사진_프로필_사진_남의_배너는_400_INVALID_BANNER_IMAGE() throws Exception {
        long incomplete = upload("banner-1500x600.webp");
        assertFieldError(setBanner(incomplete), "bannerImageId", "INVALID_BANNER_IMAGE");

        long profile =
                jdbc.queryForObject(
                        "INSERT INTO image (uploader_id, storage_key, content_type, size_bytes, width,"
                                + " height, status, purpose) VALUES (?, 'profile/b1.webp', 'image/webp',"
                                + " 1000, 256, 256, 'TEMP', 'PROFILE') RETURNING id",
                        Long.class,
                        me);
        assertFieldError(setBanner(profile), "bannerImageId", "INVALID_BANNER_IMAGE");

        long other = members().member().create();
        long others =
                jdbc.queryForObject(
                        "INSERT INTO image (uploader_id, storage_key, content_type, size_bytes, width,"
                                + " height, status, purpose) VALUES (?, 'banner/o1.webp', 'image/webp',"
                                + " 1000, 1500, 600, 'TEMP', 'BANNER') RETURNING id",
                        Long.class,
                        other);
        assertFieldError(setBanner(others), "bannerImageId", "INVALID_BANNER_IMAGE");
        assertThat(currentCount()).isZero();
    }

    @Test
    void 탈퇴_정리는_배너도_떼어_정리_대상으로_둔다() throws Exception {
        long id = upload("banner-1500x600.webp");
        api.complete(session, id);
        setBanner(id);

        tx.execute(status -> purge.detachAllByUploader(me));

        assertThat(currentCount()).isZero();
        assertThat(
                        jdbc.queryForObject(
                                "SELECT detached_at IS NOT NULL FROM image WHERE id = ?",
                                Boolean.class,
                                id))
                .isTrue();
    }
}
