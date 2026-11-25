package com.team.blog.post.application.port;

import com.team.blog.post.infra.PostQueryRepository;
import com.team.blog.shared.security.Viewer;
import org.springframework.stereotype.Service;

/**
 * 다른 모듈(005 둥지 머리말·017 카테고리 글 수)이 "남에게 보이는 글 수"를 셀 때 쓰는 창구. post 모듈의 저장소({@code
 * PostQueryRepository})를 다른 모듈이 직접 쓰지 않게 한다(모듈 경계 규칙, {@code ModuleBoundaryTest}).
 */
@Service
public class ListedPostCountQuery {

    private final PostQueryRepository posts;

    public ListedPostCountQuery(PostQueryRepository posts) {
        this.posts = posts;
    }

    /** 둥지 목록과 같은 조건({@link VisibilityFilter#forBlog})으로 센 글 수. */
    public long countListedByAuthor(Viewer viewer, long authorId) {
        return posts.countListedByAuthor(viewer, authorId);
    }
}
