import type { InputHTMLAttributes, MutableRefObject } from 'react';
import type { StorageUsage } from '../../api/images';
import type { AutosaveStatus } from '../../features/editor/autosaveQueue';
import type { useAttachments } from '../../features/attachment/useAttachments';
import { storageHint } from '../../features/image-upload/storageHint';
import { SPELL_MESSAGES } from '../../features/spell-check/messages';
import type { useSpellCheck } from '../../features/spell-check/useSpellCheck';
import SaveStatus from './SaveStatus';

export interface EditorToolbarProps {
  /** 등록한 글을 고치는 중인가 ("수정 중" 표시·[변경 취소]) */
  editingPublished: boolean;
  status: AutosaveStatus | null;
  /** 충돌이 있을 때만 — [비교하기] */
  onCompare?: () => void;
  imagesUploading: number;
  pendingCount: number;
  onCancelEdit: () => void;
  discarding: boolean;
  /** 공동 작업자는 첨부파일·사진 올리기가 없다 */
  collaborator: boolean;
  attachments: ReturnType<typeof useAttachments>;
  attachmentInputRef: MutableRefObject<HTMLInputElement | null>;
  storage: StorageUsage | null;
  imageFileInputProps: InputHTMLAttributes<HTMLInputElement>;
  spell: ReturnType<typeof useSpellCheck>;
  onSave: () => void;
  saving: boolean;
  onPublish: () => void;
}

/**
 * 글쓰기 화면 맨 위 줄: 저장 상태·사진 올리는 중 표시(왼쪽)와 [변경 취소]·[첨부파일]·[맞춤법 검사]·[임시저장]·[글 등록](오른쪽).
 * `EditorPage`에서 나눴다(2026-11-25, 동작 그대로).
 */
export default function EditorToolbar({
  editingPublished,
  status,
  onCompare,
  imagesUploading,
  pendingCount,
  onCancelEdit,
  discarding,
  collaborator,
  attachments,
  attachmentInputRef,
  storage,
  imageFileInputProps,
  spell,
  onSave,
  saving,
  onPublish,
}: Readonly<EditorToolbarProps>) {
  return (
    <header className="editor-toolbar">
      <div className="editor-state">
        {editingPublished ? <span className="editing-badge">수정 중</span> : null}
        <SaveStatus status={status} onCompare={onCompare} />
        {imagesUploading > 0 ? (
          <span className="image-uploading" aria-live="polite">
            사진 올리는 중…
          </span>
        ) : null}
        {pendingCount > 0 ? (
          <span className="image-pending" aria-live="polite">
            업로드 대기 사진 {pendingCount}장
          </span>
        ) : null}
      </div>
      <div className="editor-actions">
        {editingPublished ? (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onCancelEdit}
            disabled={discarding}
          >
            변경 취소
          </button>
        ) : null}
        {/* 018: [첨부파일] — 글에 파일을 붙인다. 본문 사진 넣기는 도구 모음의 [사진]이 맡는다.
          공동 작업자가 올린 파일·사진은 글에 붙지 않으므로 보이지 않는다 */}
        {collaborator ? null : (
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={attachments.openPicker}
              disabled={attachments.uploading > 0}
            >
              첨부파일
            </button>
            <input
              ref={attachmentInputRef}
              {...attachments.inputProps}
              aria-label="첨부파일 고르기"
            />
            {storageHint(storage) ? (
              <span className="storage-hint">{storageHint(storage)}</span>
            ) : null}
            <input {...imageFileInputProps} aria-label="사진 고르기" />
          </>
        )}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void spell.request()}
          disabled={spell.phase !== 'idle'}
          aria-busy={spell.phase === 'loading' || undefined}
        >
          {spell.phase === 'loading' ? SPELL_MESSAGES.loading : SPELL_MESSAGES.button}
        </button>
        <button type="button" className="btn" onClick={onSave} disabled={saving}>
          임시저장
        </button>
        <button type="button" className="btn btn-primary" onClick={onPublish}>
          글 등록
        </button>
      </div>
    </header>
  );
}
