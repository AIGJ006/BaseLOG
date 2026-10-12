import { useRef, useState } from 'react';
import { findOurImageUrls } from '../../features/image-upload/altText';
import { uploadImage, type UploadResult } from '../../features/image-upload/uploadImage';
import { UPLOAD_MESSAGES } from '../../features/image-upload/uploadMessages';
import NestB from '../NestB';

/**
 * 썸네일 칸 (019). 본문에 넣은 내 사진 중 하나를 누르거나 [사진 올리기]로 새로 올려 고른다. [지우기]면 지정 없음 —
 * 카드에는 둥지 B가 나온다. 새로 올린 사진은 본문에 넣지 않고 서버가 등록할 때 글에 연결한다.
 */
interface Props {
  contentMd: string;
  /** 고른 사진의 원본 주소, 지정 없음이면 null */
  value: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  error?: string | null;
  /** 테스트가 바꾼다 */
  upload?: (file: Blob) => Promise<UploadResult>;
}

export default function ThumbnailPicker({
  contentMd,
  value,
  onChange,
  disabled,
  error,
  upload = (file) => uploadImage(file),
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  /** 이 창에서 새로 올린 사진 (본문에는 없음) */
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const candidates = [...findOurImageUrls(contentMd)];
  for (const url of [...uploaded, ...(value ? [value] : [])]) {
    if (!candidates.includes(url)) candidates.push(url);
  }

  async function pick(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await upload(file);
      if (result.kind === 'uploaded') {
        setUploaded((current) => [...current, result.image.url]);
        onChange(result.image.url);
      } else if (result.kind === 'rejected') {
        setMessage(result.message);
      } else {
        setMessage(UPLOAD_MESSAGES.IMAGE_NOT_UPLOADED);
      }
    } finally {
      setBusy(false);
    }
  }

  const off = disabled || busy;

  return (
    <fieldset className="thumbnail-picker">
      <legend>썸네일</legend>
      <div className="thumbnail-current">
        <span className="thumbnail-preview" data-testid="thumbnail-preview">
          {value ? <img src={value} alt="고른 썸네일" /> : <NestB />}
        </span>
        <div className="thumbnail-actions">
          <p className="thumbnail-hint">
            {value ? '이 사진이 글 카드에 보여요' : '고르지 않으면 BaseLOG 둥지가 보여요'}
          </p>
          <div className="thumbnail-buttons">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={off}>
              {busy ? '올리는 중…' : '사진 올리기'}
            </button>
            {value ? (
              <button type="button" onClick={() => onChange(null)} disabled={off}>
                지우기
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        hidden
        data-testid="thumbnail-file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void pick(file);
        }}
      />
      {candidates.length > 0 ? (
        <>
          <p className="thumbnail-hint thumbnail-choices-label">본문 사진에서 고르기</p>
          <ul className="thumbnail-choices">
            {candidates.map((url, i) => (
              <li key={url}>
                <button
                  type="button"
                  aria-pressed={url === value}
                  aria-label={`사진 ${i + 1}을 썸네일로`}
                  onClick={() => onChange(url)}
                  disabled={off}
                >
                  <img src={url} alt="" loading="lazy" />
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {message ? <p className="field-error">{message}</p> : null}
      {error ? <p className="field-error">{error}</p> : null}
    </fieldset>
  );
}
