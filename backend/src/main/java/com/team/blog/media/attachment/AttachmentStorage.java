package com.team.blog.media.attachment;

import com.team.blog.media.application.ImageProperties;
import com.team.blog.media.infra.storage.ImageStorage;
import com.team.blog.media.infra.storage.StorageUnavailableException;
import java.io.InputStream;
import java.util.Collection;
import java.util.NoSuchElementException;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.core.exception.SdkClientException;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * 첨부파일 저장소 (018 FR-007). 사진과 같은 버킷·같은 앱 전용 키를 쓰고 키는 {@code attachments/}로 시작한다. {@code images/*}와
 * 달리 익명 읽기가 없으므로 주소를 알아도 저장소에서 바로 받을 수 없다. 지우기는 사진 저장소의 묶음 삭제를 그대로 쓴다.
 */
@Component
public class AttachmentStorage {

    private static final Logger log = LoggerFactory.getLogger(AttachmentStorage.class);

    /** 내려받는 쪽이 저장해 둘 이유가 없다 — 권한이 바뀌면 바로 막혀야 한다. */
    static final String CACHE_CONTROL = "private, no-store";

    static final String CONTENT_TYPE = "application/octet-stream";

    private final S3Client s3;
    private final ImageStorage images;
    private final String bucket;

    public AttachmentStorage(
            S3Client imageS3Client, ImageStorage images, ImageProperties properties) {
        this.s3 = imageS3Client;
        this.images = images;
        this.bucket = properties.storage().bucket();
    }

    public void put(String key, long size, InputStream content) {
        try {
            s3.putObject(
                    b ->
                            b.bucket(bucket)
                                    .key(key)
                                    .contentType(CONTENT_TYPE)
                                    .contentLength(size)
                                    .cacheControl(CACHE_CONTROL),
                    RequestBody.fromInputStream(content, size));
        } catch (S3Exception | SdkClientException e) {
            throw unavailable("put", e);
        }
    }

    /** 파일 스트림. 호출자가 닫는다. 없으면 {@link NoSuchElementException}. */
    public InputStream open(String key) {
        try {
            return s3.getObject(b -> b.bucket(bucket).key(key));
        } catch (NoSuchKeyException e) {
            throw new NoSuchElementException("저장소에 첨부파일이 없습니다");
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                throw new NoSuchElementException("저장소에 첨부파일이 없습니다");
            }
            throw unavailable("open", e);
        } catch (SdkClientException e) {
            throw unavailable("open", e);
        }
    }

    /**
     * @return 지우지 못한 키
     */
    public Set<String> deleteAll(Collection<String> keys) {
        return images.deleteAll(keys);
    }

    private static StorageUnavailableException unavailable(String operation, Exception e) {
        int status = e instanceof S3Exception s3e ? s3e.statusCode() : 0;
        log.warn(
                "첨부 저장소 호출 실패: op={}, status={}, error={}",
                operation,
                status,
                e.getClass().getSimpleName());
        return new StorageUnavailableException(e);
    }
}
