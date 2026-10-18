package com.team.blog.post.application;

import com.team.blog.media.application.ImageUrlResolver;
import com.team.blog.post.domain.CollaboratorReasonCode;
import com.team.blog.post.domain.Post;
import com.team.blog.post.domain.PostNotFoundException;
import com.team.blog.post.domain.Visibility;
import com.team.blog.post.infra.PostCollaboratorRepository;
import com.team.blog.post.infra.PostCollaboratorRepository.HandleId;
import com.team.blog.post.infra.PostEditRepository;
import com.team.blog.post.infra.PostRepository;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.event.CollaboratorAdded;
import com.team.blog.shared.event.FriendshipEnded;
import com.team.blog.shared.security.AccountStatusGuard;
import com.team.blog.shared.security.ActionKind;
import java.time.Clock;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 공동 작업자 (030). 글쓴이만 친구 중에서 최대 3명을 고르고 바꾼다(임시글·발행 글 모두). 공동 작업자는 그 글이 발행 글일 때 제목·본문만 고칠 수 있다({@link
 * #editableAuthor}) — 삭제·공개 범위·태그·카테고리·썸네일은 글쓴이만. 초대 수락·동시 편집은 없다. 친구를 끊으면 서로의 글에서 빠진다.
 */
@Service
public class PostCollaboratorService {

    private static final String HANDLES_FIELD = "handles";

    private final AccountStatusGuard accountStatusGuard;
    private final PostEditRepository edits;
    private final PostRepository posts;
    private final PostCollaboratorRepository collaborators;
    private final ImageUrlResolver imageUrls;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public PostCollaboratorService(
            AccountStatusGuard accountStatusGuard,
            PostEditRepository edits,
            PostRepository posts,
            PostCollaboratorRepository collaborators,
            ImageUrlResolver imageUrls,
            ApplicationEventPublisher events,
            Clock clock) {
        this.accountStatusGuard = accountStatusGuard;
        this.edits = edits;
        this.posts = posts;
        this.collaborators = collaborators;
        this.imageUrls = imageUrls;
        this.events = events;
        this.clock = clock;
    }

    /** 화면에 보일 공동 작업자. */
    public record Collaborator(String handle, String nickname, String profileImageUrl) {}

    /**
     * 고칠 수 있는 글의 글쓴이 번호 — 내 글이면 나, 내가 공동 작업자인 발행 글이면 그 글쓴이.
     *
     * @throws PostNotFoundException 고칠 수 없는 글 (남의 글·휴지통 글·없는 글, 구분 없음)
     */
    public long editableAuthor(long postId, long memberId) {
        return collaborators
                .findEditableAuthor(postId, memberId)
                .orElseThrow(() -> new PostNotFoundException("고칠 수 있는 글 아님"));
    }

    /** 글의 공동 작업자 (누구나 보는 "함께 쓴 사람"). */
    @Transactional(readOnly = true)
    public List<Collaborator> of(long postId) {
        return collaboratorsOf(postId);
    }

    private List<Collaborator> collaboratorsOf(long postId) {
        return collaborators.findCollaborators(postId).stream()
                .map(
                        r ->
                                new Collaborator(
                                        r.handle(),
                                        r.nickname(),
                                        imageUrls.publicUrl(r.profileKey())))
                .toList();
    }

    /** 글쓴이가 보는 목록. 내 글이 아니면 404. */
    @Transactional(readOnly = true)
    public List<Collaborator> list(long postId, long memberId) {
        requireOwned(postId, memberId);
        return collaboratorsOf(postId);
    }

    /**
     * 공동 작업자를 통째로 바꾼다. 판정 순서: 403 계정 상태 → 404 내 글 → 400 수·친구. 새로 더한 사람마다 {@link CollaboratorAdded}.
     *
     * @param handles 고른 친구 주소 (중복은 하나로)
     */
    @Transactional
    public List<Collaborator> replace(long postId, long memberId, List<String> handles) {
        accountStatusGuard.requireActive(memberId, ActionKind.CONTENT_WRITE);
        // 글을 잠가 같은 글의 바꾸기·나만 보기 등록·공개 범위 변경을 한 번에 하나씩 처리한다
        Visibility visibility =
                posts.findForUpdateByIdAndAuthorId(postId, memberId)
                        .map(Post::visibility)
                        .orElseThrow(() -> new PostNotFoundException("공동 작업자: 내 글 아님"));
        Set<String> wanted = new LinkedHashSet<>();
        if (handles != null) {
            handles.stream()
                    .filter(h -> h != null && !h.isBlank())
                    .map(String::strip)
                    .forEach(wanted::add);
        }
        if (!wanted.isEmpty() && visibility == Visibility.PRIVATE) {
            throw new ValidationException(
                    List.of(
                            CollaboratorReasonCode.PRIVATE_POST_COLLABORATORS.fieldError(
                                    HANDLES_FIELD)));
        }
        if (wanted.size() > CollaboratorReasonCode.MAX) {
            throw new ValidationException(
                    List.of(
                            CollaboratorReasonCode.TOO_MANY_COLLABORATORS.fieldError(
                                    HANDLES_FIELD)));
        }
        Map<String, Long> found =
                collaborators.findMemberIdsByHandles(wanted).stream()
                        .collect(Collectors.toMap(HandleId::handle, HandleId::memberId));
        List<Long> ids = new ArrayList<>();
        for (String handle : wanted) {
            Long id = found.get(handle);
            if (id == null || !collaborators.lockAcceptedFriendship(memberId, id)) {
                throw new ValidationException(
                        List.of(
                                CollaboratorReasonCode.COLLABORATOR_NOT_FRIEND.fieldError(
                                        HANDLES_FIELD)));
            }
            ids.add(id);
        }
        List<Long> before = collaborators.findMemberIds(postId);
        for (Long old : before) {
            if (!ids.contains(old)) {
                collaborators.delete(postId, old);
            }
        }
        for (Long id : ids) {
            if (collaborators.insert(postId, id)) {
                events.publishEvent(new CollaboratorAdded(postId, memberId, id, clock.instant()));
            }
        }
        return collaboratorsOf(postId);
    }

    /**
     * 공동 작업자가 있는 글은 나만 보기로 할 수 없다 (2026-10-16 민서). 등록·공개 범위 변경이 부른다.
     *
     * @throws ValidationException 400 {@code COLLABORATOR_POST_PRIVATE} (field {@code visibility})
     */
    public void requireNotPrivateWithCollaborators(long postId, Visibility to) {
        if (to == Visibility.PRIVATE && !collaborators.findCollaborators(postId).isEmpty()) {
            throw new ValidationException(
                    List.of(
                            CollaboratorReasonCode.COLLABORATOR_POST_PRIVATE.fieldError(
                                    "visibility")));
        }
    }

    /** 친구를 끊으면(거절·취소 포함) 서로의 글에서 공동 작업자를 지운다 — 친구 끊기와 같은 트랜잭션. */
    @EventListener
    public void on(FriendshipEnded e) {
        collaborators.deleteBetween(e.memberId(), e.otherMemberId());
    }

    private void requireOwned(long postId, long memberId) {
        if (!edits.isOwned(postId, memberId)) {
            throw new PostNotFoundException("공동 작업자: 내 글 아님");
        }
    }
}
