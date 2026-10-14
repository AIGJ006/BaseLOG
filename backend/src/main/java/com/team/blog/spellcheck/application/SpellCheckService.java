package com.team.blog.spellcheck.application;

import com.team.blog.account.application.AiConsentService;
import com.team.blog.post.application.OwnedPost;
import com.team.blog.post.application.PostOwnershipQuery;
import com.team.blog.post.domain.Visibility;
import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.NotFoundException;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.security.AccountStatusGuard;
import com.team.blog.shared.security.ActionKind;
import com.team.blog.spellcheck.application.SpellCheckRouter.Routed;
import com.team.blog.tag.application.suggest.Provider;
import com.team.blog.tag.application.suggest.SuggestPostLimits;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * AI 맞춤법·띄어쓰기 검사 (022 spec FR-003~FR-007, R1). 버튼을 누를 때만 불린다.
 *
 * <p>판정 순서: 401(컨트롤러) → 403 계정 상태({@code CONTENT_WRITE}) → 404 내 글 아님 → 503 {@code DISABLED} → 409
 * 동의 → 400 본문 길이 → 422 정리 후 짧음 → 503 쓸 공급자 없음(비공개 글 {@code NOT_PUBLIC}, 공개 글 {@code FAILED}) → 429
 * 하루 한도 → 공급자.
 *
 * <p>트랜잭션을 열지 않고 DB에 쓰지 않는다 — 검사 실패가 글 저장·발행에 닿지 않는다. 글을 바꾸지 않고 고칠 곳만 돌려준다(FR-006).
 *
 * <p>로그는 요청마다 INFO 한 줄({@code ai spell-check post=… provider=… outcome=… issues=… inputChars=…
 * took=…ms}). 본문·고칠 말은 남기지 않는다.
 */
@Service
public class SpellCheckService {

    private static final Logger log = LoggerFactory.getLogger(SpellCheckService.class);

    private final AccountStatusGuard accountStatusGuard;
    private final PostOwnershipQuery ownership;
    private final AiConsentService consent;
    private final SpellInputCleaner cleaner;
    private final SpellIssueFilter filter;
    private final SpellUsage usage;
    private final SpellCheckRouter router;
    private final SpellCheckProperties properties;
    private final SuggestPostLimits limits;
    private final Clock clock;

    public SpellCheckService(
            AccountStatusGuard accountStatusGuard,
            PostOwnershipQuery ownership,
            AiConsentService consent,
            SpellInputCleaner cleaner,
            SpellIssueFilter filter,
            SpellUsage usage,
            SpellCheckRouter router,
            SpellCheckProperties properties,
            SuggestPostLimits limits,
            Clock clock) {
        this.accountStatusGuard = accountStatusGuard;
        this.ownership = ownership;
        this.consent = consent;
        this.cleaner = cleaner;
        this.filter = filter;
        this.usage = usage;
        this.router = router;
        this.properties = properties;
        this.limits = limits;
        this.clock = clock;
    }

    /** 검사 ({@code POST /api/posts/{postId}/spell-check}). */
    public SpellCheckResult check(long memberId, String rawPostId, SpellCheckRequest request) {
        long started = System.nanoTime();
        accountStatusGuard.requireActive(memberId, ActionKind.CONTENT_WRITE);
        OwnedPost post = requireOwned(rawPostId, memberId);
        Line line = new Line(post.id(), started);
        try {
            SpellCheckResult result = check(memberId, post, request, line);
            line.issues = result.issues().size();
            line.write(result.issues().isEmpty() ? "EMPTY" : "OK");
            return result;
        } catch (SpellCheckUnavailableException e) {
            line.write(e.reason().name());
            throw e;
        } catch (SpellCheckErrors.ConsentRequired e) {
            line.write("CONSENT");
            throw e;
        } catch (SpellCheckErrors.TooShort e) {
            line.write("TOO_SHORT");
            throw e;
        } catch (SpellCheckErrors.DailyLimit e) {
            line.write("LIMIT");
            throw e;
        } catch (RuntimeException e) {
            line.write("ERROR");
            throw e;
        }
    }

    private SpellCheckResult check(
            long memberId, OwnedPost post, SpellCheckRequest request, Line line) {
        if (!properties.enabled()) {
            throw new SpellCheckUnavailableException(SpellCheckUnavailableReason.DISABLED);
        }
        if (!consent.isConsented(memberId)) {
            throw new SpellCheckErrors.ConsentRequired(consent.currentVersion());
        }
        SpellCheckRequest body = request == null ? new SpellCheckRequest("") : request;
        validate(body);
        String text = cleaner.clean(body.contentMd());
        line.inputChars = SpellInputCleaner.length(text);
        if (line.inputChars < properties.minInputChars()) {
            throw new SpellCheckErrors.TooShort(properties.minInputChars(), line.inputChars);
        }
        Instant now = clock.instant();
        Optional<Provider> chosen = router.choose(post, now);
        if (chosen.isEmpty()) {
            // 공개 글인데 공급자가 없으면(Gemini 키 없음·소진·쉬는 중 + 자체 AI 꺼짐) 비공개 안내가 아니라 실패다
            throw new SpellCheckUnavailableException(
                    post.visibility() == Visibility.PUBLIC
                            ? SpellCheckUnavailableReason.FAILED
                            : SpellCheckUnavailableReason.NOT_PUBLIC);
        }
        line.provider = chosen.get();

        int used = usage.reserve(memberId, now);
        Routed routed;
        try {
            routed = router.check(chosen.get(), text, now);
        } catch (RuntimeException e) {
            usage.release(memberId, now);
            throw e;
        }
        line.provider = routed.provider();
        switch (routed.outcome()) {
            case SpellOutcome.Success success -> {
                List<SpellIssue> issues =
                        filter.accepted(
                                success.issues(), routed.sentText(), properties.maxIssues());
                return new SpellCheckResult(
                        issues, routed.provider(), routed.truncated(), usage.remaining(used));
            }
            case SpellOutcome.Busy busy -> {
                usage.release(memberId, now);
                throw new SpellCheckUnavailableException(SpellCheckUnavailableReason.BUSY);
            }
            case SpellOutcome.Failed failed -> {
                usage.release(memberId, now);
                throw new SpellCheckUnavailableException(SpellCheckUnavailableReason.FAILED);
            }
            case SpellOutcome.QuotaExceeded quota -> {
                usage.release(memberId, now);
                throw new SpellCheckUnavailableException(SpellCheckUnavailableReason.FAILED);
            }
        }
    }

    private OwnedPost requireOwned(String rawPostId, long memberId) {
        long postId;
        try {
            postId = Long.parseLong(rawPostId);
        } catch (NumberFormatException | NullPointerException e) {
            throw new NotFoundException("post id is not a number");
        }
        if (postId <= 0) {
            throw new NotFoundException("post id is not positive");
        }
        return ownership
                .findOwned(postId, memberId)
                .orElseThrow(() -> new NotFoundException("not my post"));
    }

    /** 400 — 본문 길이(코드 포인트, 002 {@code blog.post.content-max}). */
    private void validate(SpellCheckRequest body) {
        if (SpellInputCleaner.length(body.contentMd()) > limits.contentMax()) {
            throw new ValidationException(
                    List.of(
                            new FieldError(
                                    "contentMd",
                                    "CONTENT_TOO_LONG",
                                    "본문은 " + String.format("%,d", limits.contentMax()) + "자까지예요")));
        }
    }

    /** 요청 한 줄 로그. */
    private static final class Line {
        private final long postId;
        private final long started;
        Provider provider;
        int inputChars;
        int issues;

        Line(long postId, long started) {
            this.postId = postId;
            this.started = started;
        }

        void write(String outcome) {
            log.info(
                    "ai spell-check post={} provider={} outcome={} issues={} inputChars={} took={}ms",
                    postId,
                    provider == null ? "NONE" : provider,
                    outcome,
                    issues,
                    inputChars,
                    (System.nanoTime() - started) / 1_000_000);
        }
    }
}
