import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, InputHTMLAttributes, RefObject } from 'react';
import {
  ATTACHMENT_EXTENSIONS,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_POST,
  deleteAttachment,
  listAttachments,
  uploadAttachment,
} from '../../api/attachments';
import type { Attachment } from '../../api/attachments';
import { ApiError } from '../../api/client';

export const ATTACHMENT_TOO_LARGE = '첨부파일은 10MB까지 올릴 수 있어요';
export const ATTACHMENT_LIMIT = `첨부파일은 글 하나에 ${ATTACHMENT_MAX_PER_POST}개까지 올릴 수 있어요`;
export const ATTACHMENT_TYPE = '올릴 수 없는 형식의 파일이에요';
const FAILED = '첨부파일을 올리지 못했어요. 다시 시도해 주세요';

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1).toLowerCase() : '';
}

function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return error.errors[0]?.message ?? error.message;
  }
  return FAILED;
}

export interface AttachmentsState {
  items: Attachment[];
  uploading: number;
  notice: string | null;
  clearNotice: () => void;
  openPicker: () => void;
  remove: (attachmentId: number) => Promise<void>;
  inputProps: InputHTMLAttributes<HTMLInputElement>;
}

/**
 * 글쓰기 화면의 첨부파일 (018 US1·US3). 고른 파일을 하나씩 바로 올리고, 올린 파일은 [등록]과 상관없이 그 글에 붙는다.
 * 크기·개수·형식은 미리 막아 안내하고, 서버 거절 문구는 그대로 보여 준다.
 */
export function useAttachments(
  postId: number,
  enabled: boolean,
  inputRef: RefObject<HTMLInputElement | null>,
): AttachmentsState {
  const [items, setItems] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const countRef = useRef(0);

  useEffect(() => {
    countRef.current = items.length;
  }, [items]);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    listAttachments(postId)
      .then((loaded) => {
        if (alive) setItems(loaded);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [postId, enabled]);

  const upload = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) {
          setNotice(`${ATTACHMENT_TYPE}: ${file.name}`);
          continue;
        }
        if (file.size > ATTACHMENT_MAX_BYTES) {
          setNotice(`${ATTACHMENT_TOO_LARGE}: ${file.name}`);
          continue;
        }
        if (countRef.current >= ATTACHMENT_MAX_PER_POST) {
          setNotice(ATTACHMENT_LIMIT);
          break;
        }
        countRef.current += 1;
        setUploading((n) => n + 1);
        try {
          const saved = await uploadAttachment(postId, file);
          setItems((prev) => [...prev, saved]);
        } catch (error) {
          countRef.current -= 1;
          setNotice(messageOf(error));
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [postId],
  );

  const onChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = '';
      setNotice(null);
      void upload(files);
    },
    [upload],
  );

  const remove = useCallback(
    async (attachmentId: number) => {
      try {
        await deleteAttachment(postId, attachmentId);
        setItems((prev) => prev.filter((a) => a.id !== attachmentId));
      } catch (error) {
        setNotice(messageOf(error));
      }
    },
    [postId],
  );

  const clearNotice = useCallback(() => setNotice(null), []);
  const openPicker = useCallback(() => inputRef.current?.click(), [inputRef]);

  return {
    items,
    uploading,
    notice,
    clearNotice,
    openPicker,
    remove,
    inputProps: {
      type: 'file',
      multiple: true,
      hidden: true,
      accept: ATTACHMENT_EXTENSIONS.map((e) => `.${e}`).join(','),
      onChange,
    },
  };
}
