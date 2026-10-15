/**
 * 프로필 사진·둥지 배너 자르기 (FR-049·050, 11 §4-1, 025). 고른 사진에서 정해진 비율(프로필 1:1, 배너 4:1)의 영역을 골라
 * 정해진 크기(256×256, 1500×375)로 다시 그린다 — 캔버스로 새로 인코딩하므로 EXIF 등 메타데이터가 사라지고, GIF는 첫 장면만 남는다.
 * 크기·형식의 최종 검사는 003 업로드 complete 단계가 한다.
 */
export const PROFILE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const PROFILE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PROFILE_OUTPUT_SIZE = 256;

/** 결과 크기 (가로·세로 px). 비율도 이 값에서 나온다. */
export interface CropOutput {
  width: number;
  height: number;
}

export const PROFILE_OUTPUT: CropOutput = {
  width: PROFILE_OUTPUT_SIZE,
  height: PROFILE_OUTPUT_SIZE,
};

/** 025 둥지 배너: 4:1, 1500×375 (서버 `blog.image.banner-width`·`banner-height`와 같다). */
export const BANNER_OUTPUT: CropOutput = { width: 1500, height: 375 };

export const INVALID_TYPE_MESSAGE = 'jpg·png·gif·webp 사진만 올릴 수 있어요';
export const TOO_LARGE_MESSAGE = '10MB 이하 사진만 올릴 수 있어요';

/** 고를 수 있는 파일인가. 아니면 이유. */
export function validateProfileFile(file: File): string | null {
  if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
    return INVALID_TYPE_MESSAGE;
  }
  if (file.size > PROFILE_IMAGE_MAX_BYTES) {
    return TOO_LARGE_MESSAGE;
  }
  return null;
}

/**
 * 자를 영역. `x`·`y`는 남는 여백 안에서의 위치(0 = 왼쪽·위, 0.5 = 가운데, 1 = 오른쪽·아래), `zoom`은 1(짧은 변 전체) 이상.
 */
export interface CropState {
  x: number;
  y: number;
  zoom: number;
}

export const INITIAL_CROP: CropState = { x: 0.5, y: 0.5, zoom: 1 };

/** 원본에서 자를 영역. */
export interface CropArea {
  sx: number;
  sy: number;
  width: number;
  height: number;
}

/**
 * `aspect`(가로 ÷ 세로) 비율로 자를 영역. 확대 1이면 그 비율로 원본에 들어가는 가장 큰 영역이고, 확대할수록 작아진다.
 */
export function cropArea(
  source: { width: number; height: number },
  crop: CropState,
  aspect = 1,
): CropArea {
  const zoom = Math.max(1, crop.zoom);
  let width = source.width;
  let height = width / aspect;
  if (height > source.height) {
    height = source.height;
    width = height * aspect;
  }
  width /= zoom;
  height /= zoom;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    sx: Math.round((source.width - width) * clamp(crop.x)),
    sy: Math.round((source.height - height) * clamp(crop.y)),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** 정사각형 영역 (프로필 사진). */
export function cropRect(
  source: { width: number; height: number },
  crop: CropState,
): { sx: number; sy: number; size: number } {
  const { sx, sy, width } = cropArea(source, crop, 1);
  return { sx, sy, size: width };
}

type CanvasFactory = () => HTMLCanvasElement;

/**
 * `output` 크기의 WebP Blob. WebP를 못 만드는 브라우저(사파리 — PNG를 돌려줌)는 JPEG로 다시 만든다(003 Q4·R14).
 */
export function renderCropped(
  image: HTMLImageElement,
  crop: CropState,
  output: CropOutput,
  createCanvas: CanvasFactory = () => document.createElement('canvas'),
): Promise<Blob> {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const area = cropArea({ width, height }, crop, output.width / output.height);
  const canvas = createCanvas();
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext('2d');
  if (!context) {
    return Promise.reject(new Error('canvas 2d unavailable'));
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    area.sx,
    area.sy,
    area.width,
    area.height,
    0,
    0,
    output.width,
    output.height,
  );
  const encode = (type: string) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
        type,
        0.9,
      );
    });
  return encode('image/webp').then((blob) =>
    blob.type === 'image/webp' ? blob : encode('image/jpeg'),
  );
}

/** 256×256 프로필 사진. */
export function renderSquare(
  image: HTMLImageElement,
  crop: CropState,
  createCanvas?: CanvasFactory,
): Promise<Blob> {
  return renderCropped(image, crop, PROFILE_OUTPUT, createCanvas);
}

/** 1500×375 둥지 배너 (025). */
export function renderBanner(
  image: HTMLImageElement,
  crop: CropState,
  createCanvas?: CanvasFactory,
): Promise<Blob> {
  return renderCropped(image, crop, BANNER_OUTPUT, createCanvas);
}
