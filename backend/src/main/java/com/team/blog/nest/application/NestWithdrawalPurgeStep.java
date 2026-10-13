package com.team.blog.nest.application;

import com.team.blog.nest.infra.NestRepository;
import com.team.blog.shared.application.withdraw.WithdrawalPurgeStep;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** 탈퇴 정리 order 25: 그 회원의 둥지·포인트 기록·산 물건 전부 삭제 (021 FR-040). 다시 불려도 같은 결과(멱등). */
@Component
public class NestWithdrawalPurgeStep implements WithdrawalPurgeStep {

    private static final Logger log = LoggerFactory.getLogger(NestWithdrawalPurgeStep.class);

    private final NestRepository nests;

    public NestWithdrawalPurgeStep(NestRepository nests) {
        this.nests = nests;
    }

    @Override
    public int order() {
        return 25;
    }

    @Override
    @Transactional(propagation = Propagation.MANDATORY)
    public void purge(long memberId) {
        int deleted = nests.deleteAllByMember(memberId);
        log.info("탈퇴 정리 둥지: memberId={} deleted={}", memberId, deleted);
    }
}
