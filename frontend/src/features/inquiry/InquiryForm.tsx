import { useId, useRef, useState } from 'react';
import { createInquiry } from '../../api/inquiries';
import type { Inquiry, InquiryCategory } from '../../api/types/inquiry';
import type { UploadedImage } from '../../api/types/images';
import { uploadImage, type UploadResult } from '../image-upload/uploadImage';
import { UPLOAD_MESSAGES } from '../image-upload/uploadMessages';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  INQUIRY_CONTENT_MAX,
  INQUIRY_TEXT,
  inquiryErrorMessage,
} from './inquiryText';
import '../auth/auth.css';
import './inquiry.css';

function length(text: string): number {
  return Array.from(text).length;
}

/**
 * 문의 보내기 (023): 종류 · 내용(필수, 2000자) · 사용자 신고면 신고할 사람 블로그 주소(선택) · 사진 한 장(선택).
 * 사진은 글 사진과 같은 업로드(presign → 올리기 → complete)로 올리고 번호만 함께 보낸다.
 */
export default function InquiryForm({
  onSent,
  upload = (file) => uploadImage(file),
}: Readonly<{
  onSent: (inquiry: Inquiry) => void;
  /** 테스트가 바꾼다 */
  upload?: (file: Blob) => Promise<UploadResult>;
}>) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<InquiryCategory>('BUG');
  const [content, setContent] = useState('');
  const [target, setTarget] = useState('');
  const [image, setImage] = useState<UploadedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const count = length(content);
  const over = count > INQUIRY_CONTENT_MAX;
  const empty = content.trim() === '';

  async function pick(file: File) {
    setUploading(true);
    setMessage(null);
    try {
      const result = await upload(file);
      if (result.kind === 'uploaded') {
        setImage(result.image);
      } else {
        setMessage({
          kind: 'error',
          text: result.kind === 'rejected' ? result.message : UPLOAD_MESSAGES.IMAGE_NOT_UPLOADED,
        });
      }
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (empty) {
      setMessage({ kind: 'error', text: INQUIRY_TEXT.contentRequired });
      return;
    }
    if (over) {
      setMessage({ kind: 'error', text: INQUIRY_TEXT.contentTooLong });
      return;
    }
    setSending(true);
    setMessage(null);
    try {
      const sent = await createInquiry({
        category,
        content: content.trim(),
        targetHandle: category === 'USER_REPORT' && target.trim() !== '' ? target.trim() : null,
        imageId: image?.imageId ?? null,
      });
      setContent('');
      setTarget('');
      setImage(null);
      setMessage({ kind: 'ok', text: INQUIRY_TEXT.sent });
      onSent(sent);
    } catch (error) {
      setMessage({ kind: 'error', text: inquiryErrorMessage(error) });
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="auth-form support-form" onSubmit={(event) => void submit(event)} noValidate>
      <p className="support-hint">{INQUIRY_TEXT.postReportHint}</p>
      <div className="field">
        <label htmlFor={`${id}-category`}>{INQUIRY_TEXT.categoryLabel}</label>
        <select
          id={`${id}-category`}
          value={category}
          onChange={(event) => setCategory(event.target.value as InquiryCategory)}
        >
          {CATEGORIES.map((code) => (
            <option key={code} value={code}>
              {CATEGORY_LABELS[code]}
            </option>
          ))}
        </select>
      </div>
      {category === 'USER_REPORT' ? (
        <div className="field">
          <label htmlFor={`${id}-target`}>{INQUIRY_TEXT.targetLabel}</label>
          <input
            id={`${id}-target`}
            value={target}
            maxLength={200}
            autoComplete="off"
            placeholder={INQUIRY_TEXT.targetPlaceholder}
            onChange={(event) => setTarget(event.target.value)}
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor={`${id}-content`}>{INQUIRY_TEXT.contentLabel}</label>
        <textarea
          id={`${id}-content`}
          rows={6}
          value={content}
          required
          placeholder={INQUIRY_TEXT.contentPlaceholder}
          aria-invalid={over ? true : undefined}
          onChange={(event) => setContent(event.target.value)}
        />
        <span className="inquiry-counter" data-over={over} aria-live="polite">
          {count}/{INQUIRY_CONTENT_MAX}
        </span>
      </div>
      <div className="field">
        <span>{INQUIRY_TEXT.photoLabel}</span>
        <div className="inquiry-photo">
          {image ? (
            <>
              <img src={image.thumbUrl ?? image.url} alt={INQUIRY_TEXT.photoAlt} />
              <button
                type="button"
                className="inquiry-button"
                onClick={() => setImage(null)}
                disabled={sending}
              >
                {INQUIRY_TEXT.photoRemove}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="inquiry-button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading || sending}
            >
              {uploading ? INQUIRY_TEXT.photoUploading : INQUIRY_TEXT.photoAdd}
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="visually-hidden"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="inquiry-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) void pick(file);
            }}
          />
        </div>
      </div>
      {message ? (
        <p
          role={message.kind === 'error' ? 'alert' : 'status'}
          className={message.kind === 'error' ? 'form-error' : 'status-ok'}
        >
          {message.text}
        </p>
      ) : null}
      <button type="submit" className="primary" disabled={sending || uploading || empty || over}>
        {sending ? INQUIRY_TEXT.submitting : INQUIRY_TEXT.submit}
      </button>
    </form>
  );
}
