package com.team.blog.media.attachment;

import com.team.blog.post.application.PostOwnershipQuery;
import com.team.blog.post.application.PostReadService;
import com.team.blog.shared.error.BusinessRuleException;
import com.team.blog.shared.error.NotFoundException;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.infra.ratelimit.RateLimiter;
import com.team.blog.shared.security.AccountStatusGuard;
import com.team.blog.shared.security.ActionKind;
import com.team.blog.shared.security.Viewer;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.Clock;
import java.time.Duration;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

/**
 * 글 첨부파일 (018). 올리기·지우기는 글 주인만, 목록·내려받기는 그 글을 볼 수 있는 사람(글 주인은 임시글·숨김 글도)만 한다. 볼 수 없으면 이유를 구분하지 않고
 * 404다(constitution III).
 *
 * <p>올리기 순서: 401(보안) → 403 계정 상태 → 404 내 글 아님 → 400 칸(이름·형식·크기) → 429 1분 제한 → 409 개수(빠른 확인) → 저장소에
 * 올림(트랜잭션 밖) → 짧은 트랜잭션에서 글 단위로 줄 세운 뒤 개수를 다시 보고 기록. 기록하지 못하면 올린 파일을 지운다(못 지우면 정리 목록에 넣는다).
 *
 * <p>로그에는 글·첨부 번호와 크기만 남기고 파일 이름은 남기지 않는다.
 */
@Service
public class AttachmentService {

    private static final Logger log = LoggerFactory.getLogger(AttachmentService.class);

    static final String FIELD = "file";

    /** 내려받기: 첨부와 파일 스트림(호출자가 닫는다). */
    public record Download(Attachment attachment, InputStream content) {}

    private final AccountStatusGuard statusGuard;
    private final PostOwnershipQuery ownership;
    private final PostReadService reads;
    private final AttachmentRepository attachments;
    private final AttachmentStorage storage;
    private final RateLimiter rateLimiter;
    private final AttachmentProperties properties;
    private final TransactionTemplate tx;
    private final Clock clock;
    private final ZoneId zone;
    private final Set<String> extensions;

    public AttachmentService(
            AccountStatusGuard statusGuard,
            PostOwnershipQuery ownership,
            PostReadService reads,
            AttachmentRepository attachments,
            AttachmentStorage storage,
            RateLimiter rateLimiter,
            AttachmentProperties properties,
            TransactionTemplate tx,
            Clock clock,
            ZoneId serviceZoneId) {
        this.statusGuard = statusGuard;
        this.ownership = ownership;
        this.reads = reads;
        this.attachments = attachments;
        this.storage = storage;
        this.rateLimiter = rateLimiter;
        this.properties = properties;
        this.tx = tx;
        this.clock = clock;
        this.zone = serviceZoneId;
        this.extensions = properties.extensions();
    }

    /** 글의 첨부 목록 (올린 순서). */
    public List<Attachment> list(long postId, Viewer viewer) {
        requireViewable(postId, viewer);
        return attachments.findByPost(postId);
    }

    public Download download(long postId, long attachmentId, Viewer viewer) {
        requireViewable(postId, viewer);
        Attachment attachment =
                attachments.find(postId, attachmentId).orElseThrow(NotFoundException::new);
        try {
            return new Download(attachment, storage.open(attachment.storageKey()));
        } catch (NoSuchElementException e) {
            log.warn("저장소에 없는 첨부: postId={} attachmentId={}", postId, attachmentId);
            throw new NotFoundException("저장소에 첨부파일이 없음");
        }
    }

    public Attachment upload(long memberId, long postId, MultipartFile file) {
        statusGuard.requireActive(memberId, ActionKind.CONTENT_WRITE);
        requireOwned(postId, memberId);
        String name = validate(file);
        rateLimiter.acquireOrThrow(
                "ratelimit:attachment:" + memberId,
                properties.perMinuteLimit(),
                Duration.ofMinutes(1));
        if (attachments.countByPost(postId) >= properties.maxPerPost()) {
            throw limitExceeded();
        }

        String key = newKey();
        long size = file.getSize();
        try (InputStream in = file.getInputStream()) {
            storage.put(key, size, in);
        } catch (IOException e) {
            throw new UncheckedIOException("첨부파일을 읽지 못했습니다", e);
        }

        try {
            Attachment saved =
                    tx.execute(
                            status -> {
                                attachments.lockPost(postId);
                                if (attachments.countByPost(postId) >= properties.maxPerPost()) {
                                    throw limitExceeded();
                                }
                                return attachments.insert(postId, key, name, size);
                            });
            log.info("첨부 올림: postId={} attachmentId={} size={}", postId, saved.id(), size);
            return saved;
        } catch (RuntimeException e) {
            discard(key);
            if (e instanceof DataIntegrityViolationException) {
                // 확인한 뒤 글이 완전히 지워졌다
                throw new NotFoundException("첨부를 기록할 글이 없음");
            }
            throw e;
        }
    }

    public void delete(long memberId, long postId, long attachmentId) {
        statusGuard.requireActive(memberId, ActionKind.CONTENT_CLEANUP);
        requireOwned(postId, memberId);
        String key = attachments.delete(postId, attachmentId).orElseThrow(NotFoundException::new);
        // 행을 지우면 트리거가 키를 정리 목록에 넣었다. 바로 지워 보고, 실패하면 정리 작업에 맡긴다
        try {
            if (storage.deleteAll(List.of(key)).isEmpty()) {
                attachments.removeTrash(List.of(key));
            }
        } catch (RuntimeException e) {
            log.warn("첨부 파일 즉시 삭제 실패, 정리 작업이 다시 지웁니다: postId={}", postId);
        }
        log.info("첨부 지움: postId={} attachmentId={}", postId, attachmentId);
    }

    private void requireOwned(long postId, long memberId) {
        if (ownership.findOwned(postId, memberId).isEmpty()) {
            throw new NotFoundException("내 글이 아님");
        }
    }

    private void requireViewable(long postId, Viewer viewer) {
        if (viewer.isAuthenticated() && ownership.findOwned(postId, viewer.id()).isPresent()) {
            return;
        }
        reads.requireReadable(postId, viewer);
    }

    private String validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw invalid(AttachmentReasonCode.ATTACHMENT_EMPTY);
        }
        String name = AttachmentNames.clean(file.getOriginalFilename());
        if (name.isEmpty()) {
            throw invalid(AttachmentReasonCode.ATTACHMENT_EMPTY);
        }
        if (!extensions.contains(AttachmentNames.extension(name))) {
            throw invalid(AttachmentReasonCode.ATTACHMENT_TYPE_NOT_ALLOWED);
        }
        if (file.getSize() > properties.maxBytes()) {
            throw invalid(AttachmentReasonCode.ATTACHMENT_TOO_LARGE);
        }
        return name;
    }

    private BusinessRuleException limitExceeded() {
        return new BusinessRuleException(
                AttachmentReasonCode.ATTACHMENT_LIMIT_EXCEEDED,
                Map.of("maxPerPost", properties.maxPerPost()));
    }

    private static ValidationException invalid(AttachmentReasonCode code) {
        return new ValidationException(List.of(code.fieldError(FIELD)));
    }

    /** {@code attachments/{yyyy}/{MM}/{uuid}} — 이름·확장자를 넣지 않는다. */
    private String newKey() {
        LocalDate today = LocalDate.now(clock.withZone(zone));
        return "attachments/%04d/%02d/%s"
                .formatted(today.getYear(), today.getMonthValue(), UUID.randomUUID());
    }

    private void discard(String key) {
        try {
            if (!storage.deleteAll(List.of(key)).isEmpty()) {
                attachments.queueTrash(key);
            }
        } catch (RuntimeException e) {
            attachments.queueTrash(key);
        }
    }
}
