package com.team.blog.moderation.application;

import com.team.blog.account.application.AdminMemberInfo;
import com.team.blog.account.application.AdminMemberRow;
import com.team.blog.account.application.MemberQueryService;
import com.team.blog.account.application.SuspensionDuration;
import com.team.blog.account.application.SuspensionRecord;
import com.team.blog.account.application.SuspensionService;
import com.team.blog.account.domain.MemberStatus;
import com.team.blog.moderation.infra.ReportCaseRepository;
import com.team.blog.shared.error.FieldError;
import com.team.blog.shared.error.NotFoundException;
import com.team.blog.shared.error.ValidationException;
import com.team.blog.shared.security.Viewer;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * 관리자 회원 화면 (014 T053, research R10, FR-035~FR-041): 회원 목록, 회원 정보·숨겨진 수·정지 이력 조회, 정지·해제. 정지 자체(세션
 * 삭제 포함)는 account {@link SuspensionService}가 한다.
 *
 * <p>판정 순서: 관리자 확인 → 회원(없음·익명 처리 404) → 형식 400(기간 4개 밖, 사유 없음·200자 초과) → 관리자·탈퇴 유예 400 → 이미 정지 409
 * → 세션 삭제 실패 503.
 */
@Service
public class AdminMemberService {

    /** 정지 이력 최대 개수 (contracts {@code history maxItems}). */
    static final int HISTORY_LIMIT = 50;

    /** 회원 목록 한 쪽 크기. */
    static final int LIST_PAGE_SIZE = 20;

    /** 회원 목록 검색어 최대 글자 수. */
    static final int KEYWORD_MAX_CHARS = 100;

    private final ModerationAccess access;
    private final MemberQueryService members;
    private final SuspensionService suspensions;
    private final ReportCaseRepository cases;
    private final ModerationProperties properties;
    private final Clock clock;

    public AdminMemberService(
            ModerationAccess access,
            MemberQueryService members,
            SuspensionService suspensions,
            ReportCaseRepository cases,
            ModerationProperties properties,
            Clock clock) {
        this.access = access;
        this.members = members;
        this.suspensions = suspensions;
        this.cases = cases;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * 가입 회원 목록 (가입 최근 순, 한 쪽 {@value #LIST_PAGE_SIZE}명). 익명 처리된 회원은 빠진다. 형식 오류는 400: 검색어 {@value
     * #KEYWORD_MAX_CHARS}자 초과, 상태가 {@code ACTIVE}·{@code SUSPENDED}·{@code WITHDRAWN} 밖, 쪽 번호가 1
     * 미만이거나 숫자가 아님. 마지막 쪽을 넘으면 빈 목록.
     */
    public AdminMemberList list(
            Viewer viewer, String rawKeyword, String rawStatus, String rawPage) {
        access.requireAdmin(viewer);
        List<FieldError> errors = new ArrayList<>();
        String keyword = rawKeyword == null ? null : rawKeyword.strip();
        if (keyword != null && keyword.codePointCount(0, keyword.length()) > KEYWORD_MAX_CHARS) {
            errors.add(
                    new FieldError("q", "TOO_LONG", "검색어는 " + KEYWORD_MAX_CHARS + "자까지 쓸 수 있어요"));
        }
        MemberStatus status = null;
        if (rawStatus != null && !rawStatus.isEmpty()) {
            status = CaseResolutionService.enumOrNull(MemberStatus.class, rawStatus);
            if (status == null) {
                errors.add(new FieldError("status", "INVALID_VALUE", "입력한 내용을 확인해 주세요"));
            }
        }
        int page = parsePage(rawPage, errors);
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
        long total = members.countAdminList(keyword, status);
        int totalPages = (int) ((total + LIST_PAGE_SIZE - 1) / LIST_PAGE_SIZE);
        List<AdminMemberRow> items =
                (long) (page - 1) * LIST_PAGE_SIZE >= total
                        ? List.of()
                        : members.searchAdminList(
                                keyword, status, (page - 1) * LIST_PAGE_SIZE, LIST_PAGE_SIZE);
        return new AdminMemberList(items, page, LIST_PAGE_SIZE, total, totalPages);
    }

    private static int parsePage(String raw, List<FieldError> errors) {
        if (raw == null || raw.isEmpty()) {
            return 1;
        }
        try {
            int page = Integer.parseInt(raw);
            if (page >= 1 && page <= 100_000) {
                return page;
            }
        } catch (NumberFormatException e) {
            // 아래 400
        }
        errors.add(new FieldError("page", "INVALID_VALUE", "입력한 내용을 확인해 주세요"));
        return 1;
    }

    public AdminMemberView view(Viewer viewer, String handle) {
        access.requireAdmin(viewer);
        return view(find(handle));
    }

    public AdminMemberView suspend(
            Viewer viewer, String handle, Object rawDuration, Object rawReason) {
        long admin = access.requireAdmin(viewer);
        AdminMemberInfo member = find(handle);
        List<FieldError> errors = new ArrayList<>();
        SuspensionDuration duration = parseDuration(rawDuration, errors);
        String reason = parseReason(rawReason, errors);
        if (!errors.isEmpty()) {
            throw new ValidationException(errors);
        }
        suspensions.suspend(member.id(), reason, duration, admin, clock.instant());
        return view(find(handle));
    }

    public AdminMemberView lift(Viewer viewer, String handle) {
        long admin = access.requireAdmin(viewer);
        AdminMemberInfo member = find(handle);
        suspensions.lift(member.id(), admin, clock.instant());
        return view(find(handle));
    }

    private AdminMemberInfo find(String handle) {
        return members.findAdminView(handle).orElseThrow(() -> new NotFoundException("관리자 회원: 없음"));
    }

    private AdminMemberView view(AdminMemberInfo member) {
        List<SuspensionRecord> history = suspensions.history(member.id(), HISTORY_LIMIT);
        SuspensionRecord open =
                history.stream().filter(SuspensionRecord::isOpen).findFirst().orElse(null);
        return new AdminMemberView(
                member.handle(),
                member.nickname(),
                member.role(),
                member.status(),
                member.createdAt(),
                cases.hiddenCountOfAuthor(member.id()),
                open,
                history);
    }

    private SuspensionDuration parseDuration(Object raw, List<FieldError> errors) {
        if (raw == null) {
            errors.add(new FieldError("duration", "REQUIRED", "정지 기간을 골라 주세요"));
            return null;
        }
        SuspensionDuration duration =
                CaseResolutionService.enumOrNull(SuspensionDuration.class, raw);
        if (duration == null || !properties.suspensionDurations().contains(duration)) {
            errors.add(new FieldError("duration", "INVALID_VALUE", "입력한 내용을 확인해 주세요"));
            return null;
        }
        return duration;
    }

    private String parseReason(Object raw, List<FieldError> errors) {
        String text = raw instanceof String s ? s.strip() : null;
        if (text == null || text.isEmpty()) {
            errors.add(new FieldError("reason", "REQUIRED", "정지 사유를 적어 주세요"));
            return null;
        }
        int max = properties.suspensionReasonMaxChars();
        if (text.codePointCount(0, text.length()) > max) {
            errors.add(new FieldError("reason", "TOO_LONG", "사유는 " + max + "자까지 쓸 수 있어요"));
            return null;
        }
        return text;
    }
}
