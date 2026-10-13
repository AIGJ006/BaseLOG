package com.team.blog.nest.application;

import com.team.blog.nest.domain.NestPointReason;
import com.team.blog.nest.infra.NestRepository;
import java.time.LocalDate;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 활동 포인트 (021 FR-020~FR-025). 글·댓글·받은 좋아요마다 한 번씩, 하루 상한까지 준다. 같은 글·댓글·(글, 누른 사람)은 기록의 {@code
 * source_key}가 같아 두 번 받지 않는다 — 좋아요를 취소했다 다시 눌러도 그대로다. 내 글에 단 내 좋아요는 세지 않는다.
 */
@Service
public class NestPointService {

    private static final Logger log = LoggerFactory.getLogger(NestPointService.class);

    private final NestRepository nests;
    private final NestProperties properties;
    private final NestQueryService queries;

    public NestPointService(
            NestRepository nests, NestProperties properties, NestQueryService queries) {
        this.nests = nests;
        this.properties = properties;
        this.queries = queries;
    }

    /** 글 첫 등록. */
    @Transactional
    public boolean grantPost(long authorId, long postId) {
        return grant(
                authorId,
                NestPointReason.POST,
                properties.postPoints(),
                properties.postDailyCap(),
                "POST:" + postId);
    }

    /** 댓글·답글 쓰기. */
    @Transactional
    public boolean grantComment(long authorId, long commentId) {
        return grant(
                authorId,
                NestPointReason.COMMENT,
                properties.commentPoints(),
                properties.commentDailyCap(),
                "COMMENT:" + commentId);
    }

    /** 내 글이 받은 좋아요 — 누른 사람이 나면 주지 않는다. */
    @Transactional
    public boolean grantLike(long postAuthorId, long postId, long likerId) {
        if (postAuthorId == likerId) {
            return false;
        }
        return grant(
                postAuthorId,
                NestPointReason.LIKE_RECEIVED,
                properties.likePoints(),
                properties.likeDailyCap(),
                "LIKE:" + postId + ":" + likerId);
    }

    private boolean grant(
            long memberId, NestPointReason reason, int points, int dailyCap, String sourceKey) {
        nests.ensure(memberId);
        nests.lock(memberId);
        LocalDate today = queries.today();
        if (nests.countOn(memberId, reason.name(), today) >= dailyCap) {
            log.debug("둥지 포인트 하루 상한: memberId={} reason={}", memberId, reason);
            return false;
        }
        return nests.addPoint(memberId, reason.name(), points, sourceKey, today);
    }
}
