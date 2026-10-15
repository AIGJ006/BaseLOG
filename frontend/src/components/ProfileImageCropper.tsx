import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  INITIAL_CROP,
  PROFILE_IMAGE_TYPES,
  PROFILE_OUTPUT,
  cropArea,
  renderCropped,
  validateProfileFile,
  type CropOutput,
  type CropState,
} from '../features/profile/profileImageCrop';

/** 미리보기 칸 가로(px). 정사각형은 200, 넓은 비율(배너)은 320 — 세로는 비율대로. */
const SQUARE_FRAME = 200;
const WIDE_FRAME = 320;

export interface ProfileImageCropperProps {
  /** `output` 크기로 다시 그린 결과. 업로드·연결은 부른 쪽이 [저장] 때 한다(FR-049 — 저장 전까지 연결하지 않음). */
  onCropped: (blob: Blob) => void;
  onCancel: () => void;
  /** [사진 바꾸기]에서 이미 고른 파일. 있으면 고르기 단계 없이 바로 자르기 화면을 연다. */
  file?: File | null;
  /** 결과 크기. 기본은 프로필 사진 256×256(동그란 칸), 025 둥지 배너는 1500×375(넓은 칸). 비율도 이 값을 따른다. */
  output?: CropOutput;
  /** 테스트용: 결과 그리기. 기본은 캔버스. */
  renderer?: (image: HTMLImageElement, crop: CropState) => Promise<Blob>;
}

/**
 * 사진 자르기 (001 T121, FR-049·050, 11 §4-1). jpg·png·gif·webp, 10MB 이하 파일을 고르면 `blob:` 주소로 미리 보고,
 * 보일 영역의 위치(가로·세로)와 확대를 고른 뒤 `output` 크기로 다시 그린다. 프로필 사진(1:1)과 025 둥지 배너(4:1)가 같이 쓴다.
 */
export default function ProfileImageCropper({
  onCropped,
  onCancel,
  output = PROFILE_OUTPUT,
  renderer = (image, crop) => renderCropped(image, crop, output),
  file = null,
}: ProfileImageCropperProps) {
  const aspect = output.width / output.height;
  const square = aspect === 1;
  const frameWidth = square ? SQUARE_FRAME : WIDE_FRAME;
  const frameHeight = Math.round(frameWidth / aspect);
  // 처음 받은 파일은 바로 미리보기로(다른 파일로 바꾸려면 부른 쪽이 key를 바꿔 새로 연다)
  const [initialError] = useState(() => (file ? validateProfileFile(file) : null));
  const [previewUrl, setPreviewUrl] = useState<string | null>(() =>
    file && !initialError ? URL.createObjectURL(file) : null,
  );
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<CropState>(INITIAL_CROP);
  const [error, setError] = useState<string | null>(initialError);
  const [working, setWorking] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl],
  );

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = '';
    if (picked) {
      loadFile(picked);
    }
  }

  function loadFile(file: File) {
    const invalid = validateProfileFile(file);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    setNatural(null);
    setCrop(INITIAL_CROP);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function onUse() {
    const image = imageRef.current;
    if (!image) {
      return;
    }
    setWorking(true);
    try {
      onCropped(await renderer(image, crop));
    } catch {
      setError('사진을 읽지 못했어요. 다른 사진을 골라 주세요');
    } finally {
      setWorking(false);
    }
  }

  const rect = natural ? cropArea(natural, crop, aspect) : null;
  const scale = rect ? frameWidth / rect.width : 1;

  return (
    <div className="profile-cropper">
      <label className="file-button">
        {previewUrl ? '다른 사진 고르기' : '사진 고르기'}
        <input
          type="file"
          accept={PROFILE_IMAGE_TYPES.join(',')}
          onChange={onFile}
          className="visually-hidden"
        />
      </label>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {previewUrl && (
        <>
          <div
            className="cropper-frame"
            style={{
              width: frameWidth,
              height: frameHeight,
              overflow: 'hidden',
              position: 'relative',
              borderRadius: square ? '50%' : '0.5rem',
            }}
          >
            <img
              ref={imageRef}
              src={previewUrl}
              alt="고른 사진 미리보기"
              onLoad={(e) =>
                setNatural({
                  width: e.currentTarget.naturalWidth,
                  height: e.currentTarget.naturalHeight,
                })
              }
              style={
                rect && natural
                  ? {
                      position: 'absolute',
                      maxWidth: 'none',
                      width: natural.width * scale,
                      height: natural.height * scale,
                      left: -rect.sx * scale,
                      top: -rect.sy * scale,
                    }
                  : { width: '100%', height: '100%', objectFit: 'cover' }
              }
            />
          </div>
          <div className="cropper-controls">
            <label>
              가로 위치
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={crop.x}
                onChange={(e) => setCrop({ ...crop, x: Number(e.target.value) })}
              />
            </label>
            <label>
              세로 위치
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={crop.y}
                onChange={(e) => setCrop({ ...crop, y: Number(e.target.value) })}
              />
            </label>
            <label>
              확대
              <input
                type="range"
                min={1}
                max={4}
                step={0.05}
                value={crop.zoom}
                onChange={(e) => setCrop({ ...crop, zoom: Number(e.target.value) })}
              />
            </label>
          </div>
          <div className="cropper-actions">
            <button type="button" className="primary" onClick={onUse} disabled={working}>
              이 영역 사용
            </button>
            <button type="button" onClick={onCancel}>
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
}
