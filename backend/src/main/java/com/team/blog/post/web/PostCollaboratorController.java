package com.team.blog.post.web;

import com.team.blog.post.application.PostCollaboratorService;
import com.team.blog.post.application.PostCollaboratorService.Collaborator;
import com.team.blog.shared.security.CurrentUser;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** 공동 작업자 보기·바꾸기 (030). 글쓴이만 — 남의 글·휴지통 글·없는 글은 404. */
@RestController
public class PostCollaboratorController {

    private final PostCollaboratorService service;

    public PostCollaboratorController(PostCollaboratorService service) {
        this.service = service;
    }

    /**
     * @param handles 고른 친구 주소 (최대 3명, 빈 목록이면 모두 뺌)
     */
    public record ReplaceRequest(List<String> handles) {}

    public record CollaboratorList(List<Collaborator> items) {}

    @GetMapping("/api/posts/{postId}/collaborators")
    public CollaboratorList list(@CurrentUser Long memberId, @PathVariable long postId) {
        return new CollaboratorList(service.list(postId, memberId));
    }

    @PutMapping("/api/posts/{postId}/collaborators")
    public CollaboratorList replace(
            @CurrentUser Long memberId,
            @PathVariable long postId,
            @RequestBody ReplaceRequest request) {
        return new CollaboratorList(service.replace(postId, memberId, request.handles()));
    }
}
