package com.team.blog.media.attachment;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 지운 첨부의 저장소 파일 정리 (018 FR-012). 첨부 행이 지워지면(직접 삭제, 글 완전 삭제·탈퇴·빈 임시글 정리의 CASCADE) 트리거가 남긴 키를 매일
 * 저장소에서 지우고 목록에서 뺀다. 지우지 못한 키는 다음 날 다시 본다.
 */
@Component
public class AttachmentCleanupJob {

    private static final Logger log = LoggerFactory.getLogger(AttachmentCleanupJob.class);

    static final int BATCH = 1000;

    private final AttachmentRepository attachments;
    private final AttachmentStorage storage;

    public AttachmentCleanupJob(AttachmentRepository attachments, AttachmentStorage storage) {
        this.attachments = attachments;
        this.storage = storage;
    }

    @Scheduled(cron = "${blog.attachment.cleanup-cron}", zone = "${blog.time-zone}")
    @SchedulerLock(name = "attachmentCleanup", lockAtMostFor = "PT30M")
    public void run() {
        cleanup();
    }

    /**
     * @return 지운 파일 수
     */
    public int cleanup() {
        int removed = 0;
        Set<String> failedSoFar = new HashSet<>();
        for (; ; ) {
            List<String> keys =
                    attachments.findTrash(BATCH + failedSoFar.size()).stream()
                            .filter(k -> !failedSoFar.contains(k))
                            .toList();
            if (keys.isEmpty()) {
                break;
            }
            Set<String> failed = storage.deleteAll(keys);
            List<String> done = keys.stream().filter(k -> !failed.contains(k)).toList();
            attachments.removeTrash(done);
            removed += done.size();
            failedSoFar.addAll(failed);
            if (done.isEmpty()) {
                break;
            }
        }
        if (removed > 0 || !failedSoFar.isEmpty()) {
            log.info("첨부 파일 정리: 지움={} 실패={}", removed, failedSoFar.size());
        }
        return removed;
    }
}
