package com.team.blog.media.attachment;

import com.team.blog.shared.security.CurrentUser;
import com.team.blog.shared.security.Viewer;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 글 첨부파일 API (018 contracts/openapi.yaml). 올리기는 {@code multipart/form-data}의 {@code file} 칸 하나.
 * 내려받기는 항상 {@code application/octet-stream}·{@code Content-Disposition: attachment}로 보내 브라우저가 열지 않고
 * 저장하게 한다.
 */
@RestController
public class AttachmentController {

    /**
     * 응답의 첨부 한 개.
     *
     * @param id 첨부 번호
     * @param name 파일 이름
     * @param size 바이트 수
     * @param createdAt 올린 시각
     * @param downloadUrl 내려받기 주소
     */
    public record AttachmentResponse(
            long id, String name, long size, Instant createdAt, String downloadUrl) {
        static AttachmentResponse of(Attachment a) {
            return new AttachmentResponse(
                    a.id(),
                    a.name(),
                    a.size(),
                    a.createdAt(),
                    "/api/posts/" + a.postId() + "/attachments/" + a.id() + "/download");
        }
    }

    /** 목록 응답. */
    public record AttachmentListResponse(List<AttachmentResponse> items) {}

    private final AttachmentService attachments;

    public AttachmentController(AttachmentService attachments) {
        this.attachments = attachments;
    }

    @GetMapping("/api/posts/{postId}/attachments")
    public AttachmentListResponse list(@PathVariable long postId, Viewer viewer) {
        return new AttachmentListResponse(
                attachments.list(postId, viewer).stream().map(AttachmentResponse::of).toList());
    }

    @PostMapping("/api/posts/{postId}/attachments")
    @ResponseStatus(HttpStatus.CREATED)
    public AttachmentResponse upload(
            @CurrentUser Long memberId,
            @PathVariable long postId,
            @RequestParam(name = AttachmentService.FIELD, required = false) MultipartFile file) {
        return AttachmentResponse.of(attachments.upload(memberId, postId, file));
    }

    @DeleteMapping("/api/posts/{postId}/attachments/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(
            @CurrentUser Long memberId,
            @PathVariable long postId,
            @PathVariable long attachmentId) {
        attachments.delete(memberId, postId, attachmentId);
    }

    @GetMapping("/api/posts/{postId}/attachments/{attachmentId}/download")
    public ResponseEntity<InputStreamResource> download(
            @PathVariable long postId, @PathVariable long attachmentId, Viewer viewer) {
        AttachmentService.Download download = attachments.download(postId, attachmentId, viewer);
        Attachment a = download.attachment();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(a.size())
                .cacheControl(CacheControl.noStore().cachePrivate())
                .header(
                        "Content-Disposition",
                        ContentDisposition.attachment()
                                .filename(a.name(), StandardCharsets.UTF_8)
                                .build()
                                .toString())
                .body(new InputStreamResource(download.content()));
    }
}
