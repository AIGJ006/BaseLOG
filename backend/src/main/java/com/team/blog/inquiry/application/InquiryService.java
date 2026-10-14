package com.team.blog.inquiry.application;

import com.team.blog.inquiry.infra.InquiryRepository;
import com.team.blog.inquiry.infra.InquiryRepository.InquiryRow;
import com.team.blog.media.application.InquiryImageService;
import com.team.blog.shared.error.ApiException;
import com.team.blog.shared.error.CommonReasonCode;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.infra.ratelimit.RateLimiter;
import com.team.blog.shared.security.Viewer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 문의 보내기·내가 보낸 문의 (023, {@code POST·GET /api/me/inquiries}).
 *
 * <p>판정 순서: 401 {@code LOGIN_REQUIRED} → 400 {@code VALIDATION_FAILED}(형식, {@link InquiryInput}) →
 * 429 {@code TOO_MANY_REQUESTS}({@code ratelimit:inquiry:{memberId}:1d} 하루 {@value #PER_DAY}번,
 * Redis 장애면 통과) → 400 {@code imageId}(내가 올린 완료된 사진이 아님). 정지 회원도 보낼 수 있다 — 정지에 대해 물어볼 길이 있어야 한다.
 */
@Service
public class InquiryService {

    /** 요청 제한 키 접두어. */
    public static final String RATE_LIMIT_PREFIX = "ratelimit:inquiry:";

    /** 한 사람이 하루에 보낼 수 있는 문의 수. */
    public static final int PER_DAY = 10;

    /** 내가 보낸 문의 목록에 보여 줄 수. */
    static final int MY_LIST_LIMIT = 50;

    private final InquiryRepository inquiries;
    private final InquiryImageService images;
    private final RateLimiter rateLimiter;
    private final TransactionTemplate tx;
    private final Clock clock;

    public InquiryService(
            InquiryRepository inquiries,
            InquiryImageService images,
            RateLimiter rateLimiter,
            TransactionTemplate tx,
            Clock clock) {
        this.inquiries = inquiries;
        this.images = images;
        this.rateLimiter = rateLimiter;
        this.tx = tx;
        this.clock = clock;
    }

    public InquiryView create(
            Viewer viewer, Object category, Object content, Object targetHandle, Object imageId) {
        long me = requireLogin(viewer);
        InquiryInput input = InquiryInput.parse(category, content, targetHandle, imageId);
        rateLimiter.acquireOrThrow(RATE_LIMIT_PREFIX + me + ":1d", PER_DAY, Duration.ofDays(1));
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        long id =
                Objects.requireNonNull(
                        tx.execute(
                                status -> {
                                    if (input.imageId() != null
                                            && !images.attach(me, input.imageId())) {
                                        throw ValidationException.of(
                                                "imageId", "INVALID_VALUE", "사진을 다시 올려 주세요");
                                    }
                                    return inquiries.insert(
                                            me,
                                            input.category(),
                                            input.content(),
                                            input.targetHandle(),
                                            input.imageId(),
                                            now);
                                }));
        return inquiries.find(id).map(row -> view(row, imageUrls(List.of(row)))).orElseThrow();
    }

    public InquiryView.MyList mine(Viewer viewer) {
        long me = requireLogin(viewer);
        List<InquiryRow> rows = inquiries.listByMember(me, MY_LIST_LIMIT);
        Map<Long, String> urls = imageUrls(rows);
        return new InquiryView.MyList(rows.stream().map(row -> view(row, urls)).toList());
    }

    private Map<Long, String> imageUrls(List<InquiryRow> rows) {
        return images.publicUrlsOf(
                rows.stream().map(InquiryRow::imageId).filter(Objects::nonNull).toList());
    }

    static InquiryView view(InquiryRow row, Map<Long, String> imageUrls) {
        return new InquiryView(
                row.id(),
                row.category(),
                row.content(),
                row.targetHandle(),
                row.imageId() == null ? null : imageUrls.get(row.imageId()),
                row.status(),
                row.answer(),
                row.answeredAt(),
                row.createdAt());
    }

    private static long requireLogin(Viewer viewer) {
        if (viewer == null || !viewer.isAuthenticated()) {
            throw new ApiException(CommonReasonCode.LOGIN_REQUIRED);
        }
        return viewer.id();
    }
}
