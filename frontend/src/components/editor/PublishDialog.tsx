import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { FieldError } from '../../api/client';
import { listMyFriends } from '../../api/friends';
import type { PublishResponse, ServerCopy, Visibility } from '../../api/posts';
import { EDITOR_CONFIG } from '../../features/editor/editorConfig';
import { PUBLISH_FAILED, publishOnce } from '../../features/editor/publish';
import VisibilitySelect from '../../features/visibility/VisibilitySelect';
import AiTagSuggest from '../../features/ai-suggest/AiTagSuggest';
import { normalizeTag } from '../../features/tag/normalizeTag';
import { setCollaborators } from '../../api/collaborators';
import CollaboratorPicker from '../../features/collaborators/CollaboratorPicker';
import {
  collaboratorErrorMessage,
  COLLABORATORS_NO_PRIVATE,
  PRIVATE_NO_COLLABORATORS,
  selectionChanged,
  type CollaboratorSelection,
} from '../../features/collaborators/collaboratorSelection';
import AltTextPanel from './AltTextPanel';
import TagInput from './TagInput';
import ThumbnailPicker from './ThumbnailPicker';

/**
 * 등록 설정 창 (002 T055, FR-026·038, US1 #2·#3).
 *
 * - 태그: 008 `TagInput`(정규화한 칩·순서 바꾸기·"2 / 10"·오류 칩). 보내는 `tags`는 칩의 정규화된 이름 배열(순서 그대로)이다.
 *   태그는 발행할 때만 확정된다(자동 저장 대상 아님) — 발행하지 않고 닫으면 `onTagsChange`로 받은 칩을 에디터 화면이 들고 있다가
 *   다시 열 때 넘긴다(그 브라우저 화면에만, 008 FR-014).
 * - 공개 범위: 004 `VisibilitySelect`의 값만 고르는 모드(서버는 발행 때 함께 받는다, 초기값 = working copy `visibility`).
 *   친구 공개를 고르면 내 친구 목록을 한 번 읽어, 친구가 없으면 "아직 친구가 없어서…" 안내를 보인다(004 US8 #4).
 * - [발행]을 누를 때마다 `crypto.randomUUID()`로 새 `Idempotency-Key`를 만든다. 409 `IN_PROGRESS`만 같은 키로 1초 뒤 다시
 *   (`features/editor/publish.ts`, US6 T112). 응답 전에는 버튼을 끄고 "발행 중…"으로 보인다.
 * - 409 `VERSION_CONFLICT`면 `onConflict`로 서버 내용을 넘겨 비교 창(US5)을 연다.
 * - 400 `errors[]`는 칸마다 보인다: 태그는 그 칩 옆, 공개 범위는 선택 상자 옆, 제목·본문은 `onFieldErrors`로 에디터에 넘긴다.
 * - 013 AI 태그 추천: `title`·`contentMd`를 받으면 `TagInput` 바로 아래에 `AiTagSuggest`를 둔다. 추천 칩은 누를 때만
 *   `TagInput`과 같은 검사(정규화·중복·최대 개수)를 거쳐 칩이 된다 — 서버에는 발행 때 보낸다.
 * - 019 썸네일: `contentMd`를 받으면 태그 위에 `ThumbnailPicker`를 둔다. 고른 값은 태그처럼 `onThumbnailChange`로
 *   에디터 화면이 들고 있다가 다시 열 때 넘기고, 발행 요청의 `thumbnailUrl`로 보낸다.
 * - 공동 작업자: 작성자는 태그 아래에서 친구 중 최대 3명을 고른다(`CollaboratorPicker`). 바뀌었으면
 *   [등록]이 성공한 뒤에 `PUT /api/posts/{postId}/collaborators`로 저장한다(임시글은 등록된 뒤라야 추가 알림이 간다). 저장이
 *   실패하면 글은 등록된 채로 창에 남아 [다시 저장]·[건너뛰기]를 보인다. 나만 보기 글에는 공동 작업자를 둘 수 없다 — 나만 보기를
 *   고르면 칸을 끄고(고른 사람은 그대로) 고른 사람이 있으면 등록을 막는다. 고른 사람이 있으면 나만 보기 선택지를 끈다.
 *   공동 작업자 본인(`collaborator`)에게는 썸네일·태그·공개 범위·공동 작업자 칸 없이 다시 등록할지만 묻는다 — 요청에는 작업본의
 *   값을 그대로 보내고 서버는 글의 원래 값을 지킨다.
 */
export const COLLABORATOR_PUBLISH_TEXT =
  '공동 작업자로 고친 제목과 본문을 다시 등록할까요? 공개 범위·태그·썸네일은 작성자가 정한 그대로예요.';
/** 등록은 됐는데 공동 작업자 저장이 실패했을 때 */
export const COLLABORATORS_NOT_SAVED = '글은 등록했지만 공동 작업자를 저장하지 못했어요';

export interface PublishContent {
  title: string;
  contentMd: string;
  baseVersion: number;
}

interface Props {
  postId: number;
  /** 발행 직전의 에디터 내용 (자동 저장을 멈추고 기준 버전을 확정한 뒤 돌려준다). */
  getContent: () => Promise<PublishContent>;
  initialTags: string[];
  /** 칩이 바뀔 때마다 (발행하지 않고 닫아도 다시 열 때 그대로 보이게, 008 FR-014) */
  onTagsChange?: (tags: string[]) => void;
  initialVisibility: Visibility;
  onPublished: (response: PublishResponse) => void;
  onFieldErrors: (errors: FieldError[]) => void;
  onConflict?: (server: ServerCopy) => void;
  onClose: () => void;
  /** 발행 시도가 끝났다 (성공·실패 모두) — 에디터가 자동 저장을 다시 켠다. */
  onSettled?: () => void;
  /** 지금 본문과 본문 바꾸기 — 주면 대체글 권유(003 US5)를 창 위쪽에 보인다. */
  contentMd?: string;
  /** 지금 제목 — `contentMd`와 함께 주면 AI 태그 추천(013)을 보인다. */
  title?: string;
  onContentChange?: (contentMd: string) => void;
  /** 019: 지금 썸네일 (원본 주소, 지정 없음이면 null) */
  initialThumbnailUrl?: string | null;
  onThumbnailChange?: (url: string | null) => void;
  /** 내가 이 글의 공동 작업자다 — 제목·본문만 다시 등록한다 */
  collaborator?: boolean;
}

export default function PublishDialog({
  postId,
  getContent,
  initialTags,
  onTagsChange,
  initialVisibility,
  onPublished,
  onFieldErrors,
  onConflict,
  onClose,
  onSettled,
  contentMd,
  onContentChange,
  title,
  initialThumbnailUrl = null,
  onThumbnailChange,
  collaborator = false,
}: Props) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(initialThumbnailUrl);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  /** 친구가 있나 (친구 공개를 고른 뒤 한 번 읽음, 모르면 undefined) */
  const [hasFriends, setHasFriends] = useState<boolean | undefined>(undefined);
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** 작성자의 공동 작업자 선택 (읽기 전 null) */
  const [collaborators, setCollaboratorSelection] = useState<CollaboratorSelection | null>(null);
  const [collaboratorError, setCollaboratorError] = useState<string | null>(null);
  /** 등록은 끝났고 공동 작업자 저장만 남았다 — [다시 저장]은 등록 없이 저장만 한다 */
  const [published, setPublished] = useState<PublishResponse | null>(null);
  /** 다시 그리기 전에 들어온 두 번째 제출도 막는다. */
  const inFlight = useRef(false);

  const needsFriendCheck = !collaborator && visibility === 'FRIENDS' && hasFriends === undefined;
  useEffect(() => {
    if (!needsFriendCheck) {
      return;
    }
    let active = true;
    listMyFriends()
      .then((page) => {
        if (active) setHasFriends(page.items.length > 0);
      })
      .catch(() => {
        // 읽지 못하면 안내 없이 둔다 (발행은 그대로 된다)
      });
    return () => {
      active = false;
    };
  }, [needsFriendCheck]);

  function changeTags(next: string[]) {
    setTags(next);
    // 칩이 바뀌면 칸 번호가 어긋나므로 태그 칸 오류를 지운다
    setErrors((current) => current.filter((e) => !e.field.startsWith('tags')));
    onTagsChange?.(next);
  }

  /** AI 추천 칩 → 태그 (TagInput의 추가와 같은 검사). 붙였으면 true. */
  function addSuggested(raw: string): boolean {
    const result = normalizeTag(raw);
    if (!result.ok || tags.includes(result.name) || tags.length >= EDITOR_CONFIG.maxTags) {
      return false;
    }
    changeTags([...tags, result.name]);
    return true;
  }

  function changeThumbnail(next: string | null) {
    setThumbnailUrl(next);
    setErrors((current) => current.filter((e) => e.field !== 'thumbnailUrl'));
    onThumbnailChange?.(next);
  }

  function errorFor(field: string): FieldError | undefined {
    return errors.find((e) => e.field === field);
  }

  /** 등록 뒤 공동 작업자 저장 (바뀌었을 때만). 실패하면 창에 남는다. */
  async function finish(response: PublishResponse) {
    if (!collaborator && selectionChanged(collaborators)) {
      try {
        const saved = await setCollaborators(
          postId,
          collaborators!.selected.map((p) => p.handle),
        );
        setCollaboratorSelection({
          initial: saved.items.map((p) => p.handle),
          selected: saved.items,
        });
      } catch (error) {
        setPublished(response);
        setCollaboratorError(collaboratorErrorMessage(error));
        setMessage(COLLABORATORS_NOT_SAVED);
        return;
      }
    }
    onPublished(response);
  }

  const chosenCount = collaborator ? 0 : (collaborators?.selected.length ?? 0);
  const privateSelected = !collaborator && visibility === 'PRIVATE';

  async function publish(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current) {
      return;
    }
    if (privateSelected && chosenCount > 0) {
      // 나만 보기 글에는 공동 작업자를 둘 수 없다 — 고른 사람을 몰래 지우지 않고 등록을 막는다
      setMessage(PRIVATE_NO_COLLABORATORS);
      return;
    }
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    setErrors([]);
    setCollaboratorError(null);
    try {
      if (published) {
        await finish(published);
        return;
      }
      const content = await getContent();
      const outcome = await publishOnce(postId, { ...content, tags, visibility, thumbnailUrl });
      switch (outcome.kind) {
        case 'published':
          onFieldErrors([]);
          await finish(outcome.response);
          return;
        case 'invalid':
          setErrors(outcome.errors);
          onFieldErrors(outcome.errors);
          setMessage(outcome.message);
          return;
        case 'conflict':
          setMessage(outcome.message);
          onConflict?.(outcome.server);
          return;
        case 'failed':
          setMessage(outcome.message);
          return;
      }
    } catch {
      setMessage(PUBLISH_FAILED);
    } finally {
      inFlight.current = false;
      setBusy(false);
      onSettled?.();
    }
  }

  const visibilityError = errorFor('visibility');
  const tagsError = errorFor('tags');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="publish-dialog-title"
      className="publish-dialog"
    >
      <form onSubmit={publish}>
        <h2 id="publish-dialog-title">등록 설정</h2>

        {contentMd !== undefined && onContentChange ? (
          <AltTextPanel contentMd={contentMd} onChange={onContentChange} />
        ) : null}

        {collaborator ? (
          <p className="collaborator-publish-text">{COLLABORATOR_PUBLISH_TEXT}</p>
        ) : null}

        {contentMd !== undefined && !collaborator ? (
          <ThumbnailPicker
            contentMd={contentMd}
            value={thumbnailUrl}
            onChange={changeThumbnail}
            disabled={busy}
            error={errorFor('thumbnailUrl')?.message ?? null}
          />
        ) : null}

        {collaborator ? null : (
          <>
            <fieldset>
              <legend>태그</legend>
              <TagInput
                value={tags}
                onChange={changeTags}
                max={EDITOR_CONFIG.maxTags}
                errors={errors}
                disabled={busy}
              />
              {tagsError ? <p className="field-error">{tagsError.message}</p> : null}
              {title !== undefined && contentMd !== undefined ? (
                <AiTagSuggest
                  postId={postId}
                  title={title}
                  contentMd={contentMd}
                  currentTags={tags}
                  max={EDITOR_CONFIG.maxTags}
                  onAdd={addSuggested}
                  disabled={busy}
                />
              ) : null}
            </fieldset>

            <VisibilitySelect
              value={visibility}
              onChange={setVisibility}
              disabled={busy}
              hasFriends={hasFriends}
              error={visibilityError?.message ?? null}
              disabledValues={chosenCount > 0 ? ['PRIVATE'] : []}
              disabledHint={COLLABORATORS_NO_PRIVATE}
            />

            <CollaboratorPicker
              postId={postId}
              selection={collaborators}
              onLoaded={(items) =>
                setCollaboratorSelection({ initial: items.map((p) => p.handle), selected: items })
              }
              onChange={(selected) => {
                setCollaboratorError(null);
                setCollaboratorSelection((current) =>
                  current ? { ...current, selected } : current,
                );
              }}
              disabled={busy || privateSelected}
              note={privateSelected ? PRIVATE_NO_COLLABORATORS : null}
              error={collaboratorError}
            />
          </>
        )}

        {message ? (
          <p role="alert" className="form-error">
            {message}
          </p>
        ) : null}

        <div className="dialog-actions">
          <button
            type="button"
            className="btn"
            onClick={published ? () => onPublished(published) : onClose}
            disabled={busy}
          >
            {published ? '건너뛰기' : '닫기'}
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={busy}
            aria-busy={busy || undefined}
          >
            {busy ? (published ? '저장 중…' : '등록 중…') : published ? '다시 저장' : '등록'}
          </button>
        </div>
      </form>
    </div>
  );
}
