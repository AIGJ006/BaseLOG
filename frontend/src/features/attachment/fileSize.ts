import { formatBytes } from '../image-upload/storageHint';

/** 첨부 크기 표시. 1KB 안쪽은 바이트로 적어 "0KB"로 보이지 않게 한다. */
export function formatFileSize(bytes: number): string {
  return bytes < 1024 ? `${bytes}B` : formatBytes(bytes);
}
