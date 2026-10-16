package com.team.blog.post.application;

import com.team.blog.media.application.ImageService;
import com.team.blog.media.application.OgImageResolver;
import com.team.blog.post.application.exception.PublishValidationException;
import com.team.blog.post.application.exception.VersionConflictException;
import com.team.blog.post.domain.CollaboratorReasonCode;
import com.team.blog.post.domain.Post;
import com.team.blog.post.domain.PostNotFoundException;
import com.team.blog.post.domain.PostReasonCode;
import com.team.blog.post.domain.PublishCommand;
import com.team.blog.post.domain.PublishResult;
import com.team.blog.post.domain.PublishValidator;
import com.team.blog.post.domain.ServerCopy;
import com.team.blog.post.domain.Visibility;
import com.team.blog.post.infra.PostCollaboratorRepository;
import com.team.blog.post.infra.PostDraftRepository;
import com.team.blog.post.infra.PostEditRepository;
import com.team.blog.post.infra.PostEditRepository.EditState;
import com.team.blog.post.infra.PostRepository;
import com.team.blog.post.infra.RedisAutosaveStore;
import com.team.blog.shared.application.markdown.ContentRenderer;
import com.team.blog.shared.application.markdown.ContentTooComplexException;
import com.team.blog.shared.application.markdown.ImageContext;
import com.team.blog.shared.application.markdown.ImageReferenceResolver;
import com.team.blog.shared.application.markdown.MarkdownReasonCode;
import com.team.blog.shared.application.markdown.OwnedImage;
import com.team.blog.shared.application.markdown.RenderedContent;
import com.team.blog.shared.error.BusinessRuleException;
import com.team.blog.shared.event.PostEdited;
import com.team.blog.shared.event.PostPublished;
import com.team.blog.shared.event.PostWentPublic;
import com.team.blog.shared.security.AccountStatusGuard;
import com.team.blog.shared.security.ActionKind;
import com.team.blog.tag.application.TagService;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 발행·다시 발행 (002 T050, 05 §7, research A-6). 검증·렌더링은 트랜잭션 밖, 잠금부터 작업본 삭제·이벤트 발행까지 한 트랜잭션, Redis 보관분
 * 정리는 커밋 후 같은 스레드. 트랜잭션 안의 Redis 호출은 ④ 현재 버전 읽기뿐이다. {@code @Version}은 쓰지 않는다.
 */
@Service
public class PublishService {

    private final AccountStatusGuard accountStatusGuard;
    private final PostEditRepository edits;
    private final PublishValidator validator;
    private final ContentRenderer renderer;
    private final PostRepository posts;
    private final PostDraftRepository drafts;
    private final RedisAutosaveStore autosaves;
    private final TagService tagService;
    private final ImageService imageService;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final PublishIdempotency idempotency;
    private final ImageReferenceResolver imageRefs;
    private final PostCollaboratorRepository collaborators;
    private final OgImageResolver ogImages;

    public PublishService(
            AccountStatusGuard accountStatusGuard,
            PostEditRepository edits,
            PublishValidator validator,
            ContentRenderer renderer,
            PostRepository posts,
            PostDraftRepository drafts,
            RedisAutosaveStore autosaves,
            TagService tagService,
            ImageService imageService,
            ApplicationEventPublisher events,
            TransactionTemplate tx,
            Clock clock,
            PublishIdempotency idempotency,
            ImageReferenceResolver imageRefs,
            PostCollaboratorRepository collaborators,
            OgImageResolver ogImages) {
        this.collaborators = collaborators;
        this.ogImages = ogImages;
        this.accountStatusGuard = accountStatusGuard;
        this.edits = edits;
        this.validator = validator;
        this.renderer = renderer;
        this.posts = posts;
        this.drafts = drafts;
        this.autosaves = autosaves;
        this.tagService = tagService;
        this.imageService = imageService;
        this.events = events;
        this.tx = tx;
        this.clock = clock;
        this.idempotency = idempotency;
        this.imageRefs = imageRefs;
    }

    /**
     * 발행 요청 (판정 순서 401 → 403 → 404 → 400 → 409).
     *
     * <p>같은 {@code Idempotency-Key}의 중복 판정(US6)은 요청 키 형식 확인 바로 뒤에 한다. 이 요청이 발행하게 되면 이후 어떤
     * 실패(400·409·500)에도 키를 풀고, 커밋 후 ⑨ Redis 보관분 정리 → 응답 저장 순으로 마친다. 끝난 같은 요청에는 저장된 응답을 돌려주고 이벤트를 다시
     * 내지 않는다.
     *
     * @param idempotencyKey {@code Idempotency-Key} 헤더 값
     */
    public PublishResult publish(
            long postId,
            long memberId,
            String title,
            String contentMd,
            List<String> rawTags,
            String visibility,
            long baseVersion,
            String idempotencyKey) {
        return publish(
                postId,
                memberId,
                title,
                contentMd,
                rawTags,
                visibility,
                baseVersion,
                null,
                idempotencyKey);
    }

    /**
     * 썸네일을 함께 받는 발행 (019).
     *
     * @param thumbnailUrl 고른 사진의 원본 주소, 지정 없음이면 {@code null}·빈 값
     */
    public PublishResult publish(
            long postId,
            long memberId,
            String title,
            String contentMd,
            List<String> rawTags,
            String visibility,
            long baseVersion,
            String thumbnailUrl,
            String idempotencyKey) {
        // ⓪ 계정 상태(403) → 소유(404, 잠금 없는 사전 확인) → 요청 키(400)
        accountStatusGuard.requireActive(memberId, ActionKind.CONTENT_WRITE);
        long authorId =
                collaborators
                        .findEditableAuthor(postId, memberId)
                        .orElseThrow(() -> new PostNotFoundException("발행: 고칠 수 있는 글 아님"));
        if (authorId != memberId) {
            // 030 공동 작업자: 제목·본문만 — 공개 범위·태그·썸네일은 글에 있는 그대로 다시 등록한다
            visibility = edits.findOwnedVisibility(postId, authorId).map(Enum::name).orElse(null);
            rawTags = tagService.tagNamesOf(postId);
            thumbnailUrl =
                    edits.findThumbnailUrl(postId).map(ogImages::originalImageUrl).orElse(null);
        }
        requireIdempotencyKey(idempotencyKey);
        String key = idempotencyKey.strip();
        PublishIdempotency.Decision decision =
                idempotency.begin(
                        memberId, key, postId, title, contentMd, rawTags, visibility, baseVersion);
        if (decision instanceof PublishIdempotency.Decision.Replay replay) {
            return replay.result();
        }
        String hash = ((PublishIdempotency.Decision.Proceed) decision).hash();

        boolean committedOk = false;
        try {
            PublishResult result =
                    publishOnce(
                            postId,
                            authorId,
                            title,
                            contentMd,
                            rawTags,
                            visibility,
                            baseVersion,
                            thumbnailUrl,
                            key);
            committedOk = true;
            idempotency.complete(memberId, key, hash, result);
            return result;
        } finally {
            if (!committedOk) {
                idempotency.release(memberId, key);
            }
        }
    }

    /** {@code memberId}는 글쓴이 (030 공동 작업자가 등록해도). */
    private PublishResult publishOnce(
            long postId,
            long memberId,
            String title,
            String contentMd,
            List<String> rawTags,
            String visibility,
            long baseVersion,
            String thumbnailUrl,
            String idempotencyKey) {
        // ① 검증 ② 렌더링 (트랜잭션 밖)
        PublishValidator.Validated valid =
                validator.validate(title, contentMd, rawTags, visibility);
        Thumbnail thumbnail = resolveThumbnail(thumbnailUrl, memberId);
        RenderedContent rendered;
        try {
            rendered = renderer.render(contentMd, new ImageContext(memberId));
        } catch (ContentTooComplexException e) {
            throw new PublishValidationException(
                    List.of(MarkdownReasonCode.CONTENT_TOO_COMPLEX.fieldError("contentMd")));
        }
        PublishCommand cmd =
                new PublishCommand(
                        postId,
                        memberId,
                        valid.title(),
                        contentMd,
                        valid.tags(),
                        valid.visibility(),
                        baseVersion,
                        idempotencyKey,
                        thumbnail == null ? null : thumbnail.cardUrl());
        List<String> linkedKeys = new ArrayList<>(rendered.ownedImageKeys());
        if (thumbnail != null && !linkedKeys.contains(thumbnail.storageKey())) {
            // 본문에 없는 사진을 골라도 글에 연결해 정리 작업이 지우지 않게 한다
            linkedKeys.add(thumbnail.storageKey());
        }

        Committed committed = tx.execute(status -> publishInTransaction(cmd, rendered, linkedKeys));

        // ⑨ 커밋 후 Redis 보관분 정리 (실패는 경고 로그 — RedisGuard)
        autosaves.release(postId, committed.checkedVersion(), committed.result().version());
        String url = edits.findAuthorHandle(memberId).map(h -> PostUrls.of(h, postId)).orElse(null);
        return committed.result().withUrl(url);
    }

    private Committed publishInTransaction(
            PublishCommand cmd, RenderedContent rendered, List<String> linkedKeys) {
        // ③ 잠금
        Post post =
                posts.findForUpdateByIdAndAuthorId(cmd.postId(), cmd.memberId())
                        .orElseThrow(() -> new PostNotFoundException("발행: 잠금 시 내 글 아님"));
        // 030: 공동 작업자가 있는 글은 나만 보기 불가 (잠근 뒤 확인 — 공동 작업자 바꾸기와 겹치지 않게)
        if (cmd.visibility() == Visibility.PRIVATE
                && !collaborators.findCollaborators(cmd.postId()).isEmpty()) {
            throw new PublishValidationException(
                    List.of(
                            CollaboratorReasonCode.COLLABORATOR_POST_PRIVATE.fieldError(
                                    "visibility")));
        }
        // ④ 현재 버전 = max(Redis, post_draft, post)
        EditState state =
                edits.findOwnedEditState(cmd.postId(), cmd.memberId())
                        .orElseThrow(() -> new PostNotFoundException("발행: 상태 없음"));
        ServerCopy current = EditorQueryService.currentCopy(state, autosaves.find(cmd.postId()));
        if (current.version() != cmd.baseVersion()) {
            throw new VersionConflictException(current);
        }
        // ⑤ 태그 ⑥ 사진 ⑦ 글
        tagService.replacePostTags(cmd.postId(), cmd.rawTags());
        imageService.syncPostImages(cmd.postId(), cmd.memberId(), linkedKeys);
        Instant now = PostCommandService.now(clock);
        PublishResult result = post.publish(cmd, rendered, current.version(), now);
        posts.saveAndFlush(post);
        // ⑧ 작업본 삭제 + 이벤트 (커밋 후 전달)
        drafts.deleteByPostId(cmd.postId());
        if (result.firstPublish()) {
            events.publishEvent(
                    new PostPublished(
                            cmd.postId(), cmd.memberId(), post.visibility(), result.publishedAt()));
        } else {
            events.publishEvent(new PostEdited(cmd.postId(), cmd.memberId(), result.editedAt()));
        }
        if (result.wentPublic()) {
            events.publishEvent(
                    new PostWentPublic(cmd.postId(), cmd.memberId(), result.firstPublicAt()));
        }
        return new Committed(result, current.version());
    }

    /**
     * B-8: 헤더 없음 → 400 {@code IDEMPOTENCY_KEY_REQUIRED}, UUID 아님 → 400 {@code
     * INVALID_IDEMPOTENCY_KEY}.
     */
    static void requireIdempotencyKey(String key) {
        if (key == null || key.isBlank()) {
            throw new BusinessRuleException(PostReasonCode.IDEMPOTENCY_KEY_REQUIRED);
        }
        try {
            UUID parsed = UUID.fromString(key.strip());
            if (!parsed.toString().equalsIgnoreCase(key.strip())) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException(PostReasonCode.INVALID_IDEMPOTENCY_KEY);
        }
    }

    /**
     * 019: 고른 썸네일 확인. 내가 올리고 업로드가 끝난 사진이면 카드 주소(640px 썸네일, 없으면 원본)를 돌려준다. 비었으면 지정 없음({@code null}),
     * 그 밖의 주소는 400 {@code INVALID_THUMBNAIL}.
     */
    private Thumbnail resolveThumbnail(String url, long memberId) {
        if (url == null || url.isBlank()) {
            return null;
        }
        OwnedImage owned =
                imageRefs
                        .keyOf(url.strip())
                        .map(key -> imageRefs.findOwned(List.of(key), memberId).get(key))
                        .orElse(null);
        if (owned == null) {
            throw new PublishValidationException(
                    List.of(PostReasonCode.INVALID_THUMBNAIL.fieldError("thumbnailUrl")));
        }
        String cardKey =
                owned.thumbStorageKey() != null ? owned.thumbStorageKey() : owned.storageKey();
        return new Thumbnail(owned.storageKey(), imageRefs.publicUrlOf(cardKey));
    }

    private record Thumbnail(String storageKey, String cardUrl) {}

    private record Committed(PublishResult result, long checkedVersion) {}
}
