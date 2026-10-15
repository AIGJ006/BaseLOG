package com.team.blog.inquiry.application;

import com.team.blog.account.application.MemberDisplay;
import com.team.blog.account.application.MemberQueryService;
import com.team.blog.inquiry.domain.InquiryStatus;
import com.team.blog.inquiry.infra.InquiryRepository;
import com.team.blog.inquiry.infra.InquiryRepository.InquiryRow;
import com.team.blog.media.application.InquiryImageService;
import com.team.blog.moderation.application.ModerationAccess;
import com.team.blog.shared.error.NotFoundException;
import com.team.blog.shared.event.InquiryAnswered;
import com.team.blog.shared.security.Viewer;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * 관리자 문의 목록·답변 (023, {@code GET /api/admin/inquiries}·{@code PUT·POST
 * /api/admin/inquiries/{id}/answer}). 첫머리에서 014 {@link ModerationAccess}로 관리자인지 다시 확인한다(비회원 401 →
 * 관리자 아님 404).
 *
 * <p>답을 저장하면 상태가 답변 완료가 된다. 처음 답할 때만 {@link InquiryAnswered}를 발행해 문의한 회원에게 🔔 알림이 간다 — 답을 고칠 때는 다시
 * 알리지 않는다.
 */
@Service
public class AdminInquiryService {

    /** 관리자 목록 한 쪽 크기. */
    public static final int PAGE_SIZE = 20;

    private final ModerationAccess access;
    private final InquiryRepository inquiries;
    private final InquiryImageService images;
    private final MemberQueryService members;
    private final ApplicationEventPublisher events;
    private final TransactionTemplate tx;
    private final Clock clock;

    public AdminInquiryService(
            ModerationAccess access,
            InquiryRepository inquiries,
            InquiryImageService images,
            MemberQueryService members,
            ApplicationEventPublisher events,
            TransactionTemplate tx,
            Clock clock) {
        this.access = access;
        this.inquiries = inquiries;
        this.images = images;
        this.members = members;
        this.events = events;
        this.tx = tx;
        this.clock = clock;
    }

    /**
     * @param status {@code null}이면 전부
     * @param before 이 번호보다 앞선 것부터 (첫 쪽은 {@code null})
     */
    public AdminInquiryView.Page list(Viewer viewer, InquiryStatus status, Long before) {
        access.requireAdmin(viewer);
        List<InquiryRow> rows = inquiries.listForAdmin(status, before, PAGE_SIZE + 1);
        boolean more = rows.size() > PAGE_SIZE;
        List<InquiryRow> page = more ? rows.subList(0, PAGE_SIZE) : rows;
        List<AdminInquiryView> items = views(page);
        Long nextBefore = more ? page.get(page.size() - 1).id() : null;
        return new AdminInquiryView.Page(items, nextBefore);
    }

    /** 문의 하나(관리자 문의 목록에서 누른 것). 없으면 404. */
    public AdminInquiryView get(Viewer viewer, long inquiryId) {
        access.requireAdmin(viewer);
        InquiryRow row =
                inquiries.find(inquiryId).orElseThrow(() -> new NotFoundException("문의: 없는 번호"));
        return views(List.of(row)).get(0);
    }

    public AdminInquiryView answer(Viewer viewer, long inquiryId, Object rawAnswer) {
        long adminId = access.requireAdmin(viewer);
        String answer = InquiryInput.parseAnswer(rawAnswer);
        Instant now = clock.instant().truncatedTo(ChronoUnit.MICROS);
        InquiryRow saved =
                tx.execute(
                        status -> {
                            InquiryRow row =
                                    inquiries
                                            .lock(inquiryId)
                                            .orElseThrow(() -> new NotFoundException("문의: 없는 번호"));
                            inquiries.saveAnswer(inquiryId, answer, adminId, now);
                            if (row.status() == InquiryStatus.RECEIVED) {
                                events.publishEvent(
                                        new InquiryAnswered(inquiryId, row.memberId(), now));
                            }
                            return inquiries.find(inquiryId).orElseThrow();
                        });
        return views(List.of(Objects.requireNonNull(saved))).get(0);
    }

    private List<AdminInquiryView> views(List<InquiryRow> rows) {
        Map<Long, MemberDisplay> displays =
                members.findDisplays(rows.stream().map(InquiryRow::memberId).distinct().toList());
        Map<Long, String> urls =
                images.publicUrlsOf(
                        rows.stream().map(InquiryRow::imageId).filter(Objects::nonNull).toList());
        return rows.stream()
                .map(
                        row -> {
                            MemberDisplay display = displays.get(row.memberId());
                            AdminInquiryView.Member member =
                                    display == null
                                            ? new AdminInquiryView.Member(null, null, true)
                                            : new AdminInquiryView.Member(
                                                    display.handle(),
                                                    display.nickname(),
                                                    display.withdrawn());
                            return new AdminInquiryView(
                                    row.id(),
                                    member,
                                    row.category(),
                                    row.content(),
                                    row.targetHandle(),
                                    row.imageId() == null ? null : urls.get(row.imageId()),
                                    row.status(),
                                    row.answer(),
                                    row.answeredAt(),
                                    row.createdAt());
                        })
                .toList();
    }
}
