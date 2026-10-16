package com.team.blog.shared.db;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.team.blog.support.IntegrationTestBase;
import java.sql.SQLException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

/**
 * Flyway V1(= docs/51 SQL 블록) + V2(shedlock)를 빈 DB에 적용한 결과가 51 §검증 결과의 카탈로그 수치와 같은지 확인한다.
 *
 * <p>V3(017 카테고리, 개인 확장)가 더하는 것은 {@code V3_*} 상수로 따로 더한다 — 51 기준선 수치는 그대로 읽히게 둔다.
 */
class FlywayBaselineIntegrationTest extends IntegrationTestBase {

    /** 업무 테이블만 (Flyway 이력·ShedLock 제외). */
    private static final String BUSINESS =
            "n.nspname = 'public' AND c.relname NOT IN ('flyway_schema_history', 'shedlock')";

    /**
     * V3: category 테이블 1, 컬럼 8 + post.category_id 1, PK 1·FK 3·CHECK 3, 별도 인덱스 4(UNIQUE 1), 시각 컬럼
     * 2.
     */
    private static final int V3_TABLES = 1;

    private static final int V3_COLUMNS = 9;
    private static final int V3_FK = 3;
    private static final int V3_CHECK = 3;
    private static final int V3_INDEXES = 4;
    private static final int V3_UNIQUE_INDEXES = 1;
    private static final int V3_TIMESTAMPTZ = 2;

    /**
     * V4(018 첨부파일, 개인 확장): post_attachment·attachment_trash 테이블 2, 컬럼 6+2, PK 2·FK 1·UNIQUE 1·CHECK
     * 2, 별도 인덱스 1, 시각 컬럼 2.
     */
    private static final int V4_TABLES = 2;

    private static final int V4_COLUMNS = 8;
    private static final int V4_FK = 1;
    private static final int V4_UNIQUE = 1;
    private static final int V4_CHECK = 2;
    private static final int V4_INDEXES = 1;
    private static final int V4_TIMESTAMPTZ = 2;

    /** V7(004 친구 공개 켜기): CHECK 2개는 바꾸기만(수 그대로), 별도 인덱스 ix_post_blog_friends 1. */
    private static final int V7_INDEXES = 1;

    /** V8(007 비밀 댓글): comment.secret 컬럼 1. */
    private static final int V8_COLUMNS = 1;

    /**
     * V9(021 둥지 꾸미기): nest·nest_point·nest_item 테이블 3, 컬럼 9+7+4, PK 3·FK 3·UNIQUE 1·CHECK 4, 별도 인덱스
     * 2, 시각 컬럼 4.
     */
    private static final int V9_TABLES = 3;

    private static final int V9_COLUMNS = 20;
    private static final int V9_FK = 3;
    private static final int V9_UNIQUE = 1;
    private static final int V9_CHECK = 4;
    private static final int V9_INDEXES = 2;
    private static final int V9_TIMESTAMPTZ = 4;

    /**
     * V12(023 문의·신고): inquiry 테이블 1, 컬럼 11, PK 1·FK 3·CHECK 4, 별도 인덱스 2, 시각 컬럼 2. 알림 종류 CHECK는
     * 바꾸기만(수 그대로).
     */
    private static final int V12_TABLES = 1;

    private static final int V12_COLUMNS = 11;
    private static final int V12_FK = 3;
    private static final int V12_CHECK = 4;
    private static final int V12_INDEXES = 2;
    private static final int V12_TIMESTAMPTZ = 2;

    /** V13(024 관리자 통계): site_visit_daily 테이블 1, 컬럼 4, PK 1·CHECK 1, 시각 컬럼 1. */
    private static final int V13_TABLES = 1;

    private static final int V13_COLUMNS = 4;
    private static final int V13_CHECK = 1;
    private static final int V13_TIMESTAMPTZ = 1;

    /** V14(025 둥지 배너): 별도 인덱스 1(UNIQUE 1, uq_image_banner_current). 사진 용도 CHECK는 바꾸기만(수 그대로). */
    private static final int V14_INDEXES = 1;

    private static final int V14_UNIQUE_INDEXES = 1;

    /** V15(025 배너 색): member.banner_color 컬럼 1, CHECK 1. */
    private static final int V15_COLUMNS = 1;

    private static final int V15_CHECK = 1;

    /**
     * V18(021 둥지 프로필에 새 보이기): nest.show_on_blog 컬럼 1(2026-10-16 설정을 없애 지금은 안 씀, 칸은 남김).
     * (V16·V17·V19·V20은 환불 데이터만)
     */
    private static final int V18_COLUMNS = 1;

    /** V21(028 고정 글): post.pinned_at 컬럼 1(시각). 인덱스 없음. */
    private static final int V21_COLUMNS = 1;

    private static final int V21_TIMESTAMPTZ = 1;

    private long count(String sql) {
        return jdbc.queryForObject(sql, Long.class);
    }

    @Test
    void 업무_테이블_20개와_shedlock() {
        assertThat(
                        count(
                                "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace"
                                        + " WHERE c.relkind = 'r' AND "
                                        + BUSINESS))
                .isEqualTo(20 + V3_TABLES + V4_TABLES + V9_TABLES + V12_TABLES + V13_TABLES);
        assertThat(
                        count(
                                "SELECT count(*) FROM pg_tables WHERE schemaname = 'public' AND tablename = 'shedlock'"))
                .isEqualTo(1);
    }

    @Test
    void 업무_컬럼_148개() {
        assertThat(
                        count(
                                "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'"
                                        + " AND table_name NOT IN ('flyway_schema_history', 'shedlock')"))
                .isEqualTo(
                        148
                                + V3_COLUMNS
                                + V4_COLUMNS
                                + V8_COLUMNS
                                + V9_COLUMNS
                                + V12_COLUMNS
                                + V13_COLUMNS
                                + V15_COLUMNS
                                + V18_COLUMNS
                                + V21_COLUMNS);
    }

    @Test
    void 제약_PK_20_FK_40_UNIQUE_9_CHECK_52() {
        String base =
                "SELECT count(*) FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid"
                        + " JOIN pg_namespace n ON n.oid = c.relnamespace WHERE "
                        + BUSINESS
                        + " AND k.contype = ";
        assertThat(count(base + "'p'"))
                .isEqualTo(20 + V3_TABLES + V4_TABLES + V9_TABLES + V12_TABLES + V13_TABLES);
        assertThat(count(base + "'f'")).isEqualTo(40 + V3_FK + V4_FK + V9_FK + V12_FK);
        assertThat(count(base + "'u'")).isEqualTo(9 + V4_UNIQUE + V9_UNIQUE);
        assertThat(count(base + "'c'"))
                .isEqualTo(52 + V3_CHECK + V4_CHECK + V9_CHECK + V12_CHECK + V13_CHECK + V15_CHECK);
    }

    @Test
    void 별도_인덱스_42개_UNIQUE_인덱스_5개_GIN_4개() {
        String standalone =
                "FROM pg_index i JOIN pg_class ic ON ic.oid = i.indexrelid"
                        + " JOIN pg_class c ON c.oid = i.indrelid JOIN pg_namespace n ON n.oid = c.relnamespace"
                        + " JOIN pg_am am ON am.oid = ic.relam WHERE "
                        + BUSINESS
                        + " AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.indexrelid)";
        assertThat(count("SELECT count(*) " + standalone))
                .isEqualTo(
                        42
                                + V3_INDEXES
                                + V4_INDEXES
                                + V7_INDEXES
                                + V9_INDEXES
                                + V12_INDEXES
                                + V14_INDEXES);
        assertThat(count("SELECT count(*) " + standalone + " AND i.indisunique"))
                .isEqualTo(5 + V3_UNIQUE_INDEXES + V14_UNIQUE_INDEXES);
        assertThat(count("SELECT count(*) " + standalone + " AND am.amname = 'gin'")).isEqualTo(4);
    }

    @Test
    void pg_trgm_확장이_있다() {
        assertThat(count("SELECT count(*) FROM pg_extension WHERE extname = 'pg_trgm'"))
                .isEqualTo(1);
    }

    @Test
    void 시각_컬럼은_모두_timestamptz() {
        String cols =
                "SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public'"
                        + " AND table_name NOT IN ('flyway_schema_history', 'shedlock') AND data_type = ";
        assertThat(count(cols + "'timestamp without time zone'")).isZero();
        assertThat(count(cols + "'timestamp with time zone'"))
                .isEqualTo(
                        41
                                + V3_TIMESTAMPTZ
                                + V4_TIMESTAMPTZ
                                + V9_TIMESTAMPTZ
                                + V12_TIMESTAMPTZ
                                + V13_TIMESTAMPTZ
                                + V21_TIMESTAMPTZ);
    }

    @Test
    void uq_member_nickname은_대소문자를_무시하고_중복을_막는다() {
        jdbc.update("INSERT INTO member (handle, nickname) VALUES ('kim_one', 'Kim')");
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "INSERT INTO member (handle, nickname) VALUES ('kim_two', 'kim')"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("23505"))
                .hasMessageContaining("uq_member_nickname");
    }

    @Test
    void ck_friendship_order는_a가_b보다_작아야_한다() {
        long a = members().member().create();
        long b = members().member().create();
        long small = Math.min(a, b);
        long big = Math.max(a, b);
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "INSERT INTO friendship (member_a_id, member_b_id, requested_by)"
                                                + " VALUES (?, ?, ?)",
                                        big,
                                        small,
                                        big))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_friendship_order");
        assertThatThrownBy(
                        () ->
                                jdbc.update(
                                        "INSERT INTO friendship (member_a_id, member_b_id, requested_by)"
                                                + " VALUES (?, ?, ?)",
                                        small,
                                        small,
                                        small))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_friendship_order");
    }

    @Test
    void uq_image_profile_current는_회원당_현재_프로필_사진_하나만_허용한다() {
        long m = members().member().create();
        String insert =
                "INSERT INTO image (uploader_id, storage_key, content_type, size_bytes, width, height,"
                        + " status, purpose) VALUES (?, ?, 'image/webp', 1000, 256, 256, 'ATTACHED', 'PROFILE')";
        jdbc.update(insert, m, "profile/a.webp");
        assertThatThrownBy(() -> jdbc.update(insert, m, "profile/b.webp"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("23505"))
                .hasMessageContaining("uq_image_profile_current");
    }

    @Test
    void uq_image_banner_current는_회원당_지금_배너_하나만_허용하고_프로필_사진과는_따로다() {
        long m = members().member().create();
        String insert =
                "INSERT INTO image (uploader_id, storage_key, content_type, size_bytes, width, height,"
                        + " status, purpose) VALUES (?, ?, 'image/webp', 1000, 1500, 375, 'ATTACHED', ?)";
        jdbc.update(insert, m, "profile/c.webp", "PROFILE");
        jdbc.update(insert, m, "banner/a.webp", "BANNER");
        assertThatThrownBy(() -> jdbc.update(insert, m, "banner/b.webp", "BANNER"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .satisfies(e -> assertThat(sqlState(e)).isEqualTo("23505"))
                .hasMessageContaining("uq_image_banner_current");
        assertThatThrownBy(() -> jdbc.update(insert, m, "other/a.webp", "COVER"))
                .isInstanceOf(DataIntegrityViolationException.class)
                .hasMessageContaining("ck_image_purpose");
    }

    private static String sqlState(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof SQLException sql && sql.getSQLState() != null) {
                return sql.getSQLState();
            }
        }
        return null;
    }
}
