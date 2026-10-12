import type { Attachment } from '../../api/attachments';
import { formatBytes } from '../image-upload/storageHint';
import { ATTACHMENT_MAX_PER_POST } from '../../api/attachments';
import './attachment.css';

interface Props {
  items: Attachment[];
  uploading: number;
  notice: string | null;
  onRemove: (attachmentId: number) => void;
  onCloseNotice: () => void;
}

/** 글쓰기 화면 아래의 첨부파일 목록 (018 US1·US3). 첨부가 없고 올리는 중도 아니면 그리지 않는다. */
export default function AttachmentEditorList({
  items,
  uploading,
  notice,
  onRemove,
  onCloseNotice,
}: Props) {
  if (items.length === 0 && uploading === 0 && !notice) {
    return null;
  }
  return (
    <section className="attachment-box" aria-label="첨부파일">
      <h2 className="attachment-box__title">
        첨부파일 {items.length}/{ATTACHMENT_MAX_PER_POST}
        {uploading > 0 ? (
          <span className="attachment-box__status" aria-live="polite">
            {' '}
            · 올리는 중…
          </span>
        ) : null}
      </h2>
      {notice ? (
        <p role="alert" className="form-error attachment-box__notice">
          {notice}{' '}
          <button type="button" className="link-button" onClick={onCloseNotice}>
            닫기
          </button>
        </p>
      ) : null}
      {items.length > 0 ? (
        <ul className="attachment-list">
          {items.map((a) => (
            <li key={a.id} className="attachment-list__item">
              <span className="attachment-list__icon" aria-hidden="true">
                📎
              </span>
              <span className="attachment-list__name">{a.name}</span>
              <span className="attachment-list__size">{formatBytes(a.size)}</span>
              <button
                type="button"
                className="btn-ghost attachment-list__remove"
                aria-label={`${a.name} 삭제`}
                onClick={() => onRemove(a.id)}
              >
                삭제
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
