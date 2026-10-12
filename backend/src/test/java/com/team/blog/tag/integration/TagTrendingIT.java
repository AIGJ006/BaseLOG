package com.team.blog.tag.integration;

import static com.team.blog.tag.support.TagApi.body;
import static com.team.blog.tag.support.TagApi.read;
import static com.team.blog.tag.support.TagApi.status;
import static org.assertj.core.api.Assertions.assertThat;

import com.team.blog.support.IntegrationTestBase;
import com.team.blog.support.fixture.PostFixtures;
import com.team.blog.tag.support.TagApi;
import com.team.blog.tag.support.TagFixtures;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MvcResult;

/**
 * 요즘 인기 태그 (홈 오른쪽 칸, 2026-10-12). 최근 7일 안에 처음 전체 공개된 공개 글 수 많은 순(같으면 이름 순) 상위 15개, 그런 글이 없으면 전체 순위
 * 상위 15개.
 */
class TagTrendingIT extends IntegrationTestBase {

    private TagFixtures tags() {
        return new TagFixtures(jdbc);
    }

    private PostFixtures posts() {
        return new PostFixtures(jdbc);
    }

    private List<Map<String, Object>> trending() throws Exception {
        MvcResult result = new TagApi(mockMvc).getRaw(null, "/api/tags/trending");
        assertThat(status(result)).as(body(result)).isEqualTo(200);
        return read(result, "$.items");
    }

    private static List<Object> names(List<Map<String, Object>> items) {
        return items.stream().map(i -> i.get("name")).toList();
    }

    private long publicPost(long author, String... names) {
        long id = posts().create(author, PostFixtures.State.PUBLISHED_PUBLIC);
        tags().attach(id, names);
        return id;
    }

    private void makeOld(long postId) {
        jdbc.update(
                "UPDATE post SET first_public_at = now() - interval '30 days',"
                        + " published_at = now() - interval '30 days' WHERE id = ?",
                postId);
    }

    @Test
    void 최근_7일_글_수_순이고_오래된_글_태그는_세지_않는다() throws Exception {
        long author = members().member().create();
        // 오래된 글에 많이 쓰인 태그
        for (int i = 0; i < 5; i++) {
            makeOld(publicPost(author, "old-hot"));
        }
        publicPost(author, "new-b", "new-a");
        publicPost(author, "new-b");
        makeOld(publicPost(author, "new-a"));
        long hidden = posts().create(author, PostFixtures.State.PUBLISHED_PRIVATE);
        tags().attach(hidden, "private-only");

        List<Map<String, Object>> items = trending();

        assertThat(names(items)).containsExactly("new-b", "new-a");
        assertThat(items.get(0)).containsEntry("postCount", 2);
        // 기간 안 글 수만 센다(오래된 new-a 글은 빠짐)
        assertThat(items.get(1)).containsEntry("postCount", 1);
    }

    @Test
    void 최근_글이_없으면_전체_순위로_채운다() throws Exception {
        long author = members().member().create();
        makeOld(publicPost(author, "java"));
        makeOld(publicPost(author, "java"));
        makeOld(publicPost(author, "spring"));

        assertThat(names(trending())).containsExactly("java", "spring");
    }

    @Test
    void 최대_15개() throws Exception {
        long author = members().member().create();
        for (int i = 0; i < 20; i++) {
            publicPost(author, String.format("t-%02d", i));
        }

        assertThat(trending()).hasSize(15);
    }

    @Test
    void 태그가_하나도_없으면_빈_목록() throws Exception {
        assertThat(trending()).isEmpty();
    }
}
