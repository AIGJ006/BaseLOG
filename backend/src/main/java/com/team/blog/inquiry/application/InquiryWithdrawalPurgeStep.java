package com.team.blog.inquiry.application;

import com.team.blog.inquiry.infra.InquiryRepository;
import com.team.blog.shared.application.withdraw.WithdrawalPurgeStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 탈퇴 정리 order 85: 그 회원이 보낸 문의 전부 삭제 (023). 붙인 사진은 order 40 사진 정리가 함께 연결 해제로 표시한다. 다시 불려도 같은 결과(멱등).
 */
@Component
public class InquiryWithdrawalPurgeStep implements WithdrawalPurgeStep {

    private static final Logger log = LoggerFactory.getLogger(InquiryWithdrawalPurgeStep.class);

    static final int ORDER = 85;

    private final InquiryRepository inquiries;

    public InquiryWithdrawalPurgeStep(InquiryRepository inquiries) {
        this.inquiries = inquiries;
    }

    @Override
    public int order() {
        return ORDER;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void purge(long memberId) {
        int deleted = inquiries.deleteAllByMember(memberId);
        log.info("탈퇴 정리 문의: memberId={} deleted={}", memberId, deleted);
    }
}
