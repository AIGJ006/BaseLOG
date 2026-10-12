# Feature Specification: 글 썸네일 지정

**Feature Branch**: `019-post-thumbnail`

**Created**: 2026-10-12

**Status**: Implemented

**Input**: 민서 요청(2026-10-12) "썸네일을 지정하게 해주고 지정이 없으면 우리 로고 B만 썸네일에 나오게 해줘". 나민서 개인 확장 — 공통 스펙 001~018과 원문 docs/는 바꾸지 않는다(constitution I).

## Clarifications

### Session 2026-10-12 (추천안대로 결정, 민서 위임)

- Q: 어디서 고르나? → A: velog처럼 [글 등록] 창의 "썸네일" 칸. 본문에 넣은 내 사진 중 하나를 누르거나 [사진 올리기]로 새로 올린다. [지우기]로 지정을 없앤다.
- Q: 지정하지 않으면? → A: 본문 첫 사진을 자동으로 쓰지 않는다. 카드에는 로고의 둥지 B 그림(라이트·다크 각각)이 나온다. PR #39의 "제목 첫 글자 표지"는 이걸로 바뀐다.
- Q: 이미 등록된 글은? → A: 지금까지 자동으로 들어간 썸네일은 "지정 없음"으로 본다(Flyway V5가 `post.thumbnail_url`을 비움). 그래서 기존 글도 B로 보이고, 고치기 → [등록]에서 다시 고를 수 있다.
- Q: 링크 미리보기(og:image)는? → A: 지정한 썸네일의 원본 사진. 없으면 서비스 기본 이미지 `/og-default.png`(옅은 파란 바탕에 둥지 B, 1200×630).
- Q: 무엇을 저장하나? → A: 기존 칸 `post.thumbnail_url`에 고른 사진의 640px 썸네일 주소(없으면 원본 주소)를 저장한다. 새 칸은 없다. 다시 렌더링(RerenderJob)은 이 값을 건드리지 않는다.
- Q: 고를 수 있는 사진은? → A: 내가 올리고 업로드가 끝난 사진만. 본문에 없는 사진을 골라도 글에 연결(post_image)해서 정리 작업이 지우지 않는다. 남의 사진·모르는 주소는 400 `VALIDATION_FAILED`, `errors[].field = "thumbnailUrl"`, code `INVALID_THUMBNAIL`.

## User Scenarios & Testing

### User Story 1 - 썸네일 고르기 (Priority: P1)

**Acceptance Scenarios**:

1. **Given** 본문에 내 사진이 둘 있을 때, **When** [글 등록] 창에서 두 번째 사진을 고르고 [등록]하면, **Then** 홈·블로그·검색 카드에 그 사진의 썸네일이 나온다.
2. **Given** [사진 올리기]로 본문에 없는 사진을 올려 고르면, **Then** 그 사진이 카드에 나오고 본문은 바뀌지 않는다.
3. **Given** 썸네일을 지정한 글을 고칠 때, **When** [글 등록] 창을 열면, **Then** 지금 썸네일이 골라진 채로 보이고 [지우기]로 없앨 수 있다.
4. **Given** 남의 사진 주소를 보내면, **Then** 400 `INVALID_THUMBNAIL`.

### User Story 2 - 지정이 없을 때 둥지 B (Priority: P1)

**Acceptance Scenarios**:

1. **Given** 썸네일을 지정하지 않고 등록한 글(본문에 사진이 있어도), **Then** 카드에는 둥지 B 그림이 나오고 다크 모드에서는 다크용 그림이 나온다.
2. **Given** 기존 글(V5 적용 뒤), **Then** 둥지 B가 나온다.
3. **Given** 썸네일 없는 글의 링크를 공유하면, **Then** og:image는 `/og-default.png`.

## Requirements

- **FR-001**: 발행 요청 `PublishRequest`에 선택 칸 `thumbnailUrl`(고른 사진의 원본 주소, 없으면 null)을 더한다.
- **FR-002**: 에디터 열기 응답 `WorkingCopy`에 `thumbnailUrl`(지금 썸네일의 원본 주소, 없으면 null)을 더한다.
- **FR-003**: `post.thumbnail_url`은 작성자가 고른 값만 담는다. 본문 렌더링 결과로 채우지 않는다.
- **FR-004**: 카드의 빈 썸네일은 둥지 B 그림(`logo-b-light.png`·`logo-b-dark.png`)을 `--color-brand-soft` 바탕 가운데에 둔다. 색은 tokens.css 토큰만.
- **FR-005**: 화면 문구는 "등록"을 쓴다(PR #40).
