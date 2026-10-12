# Feature Specification: 글 첨부파일

**Feature Branch**: `018-attachment`

**Created**: 2026-10-12

**Status**: Implemented

**Input**: 민서 요청(2026-10-12) "글쓸 때 [파일]을 누르면 첨부파일로 올라가는 게 아니라 본문에 올라가는 것 같은데, 첨부파일로 해야 될 것 같아". 나민서 개인 확장 — 공통 스펙 001~017과 원문 docs/는 바꾸지 않는다(constitution I).

## Clarifications

### Session 2026-10-12 (추천안대로 결정, 민서 위임)

- Q: 글쓰기 머리의 [파일] 버튼은? → A: [첨부파일]로 바꿔 첨부 전용으로 쓴다. 본문 사진 넣기는 도구 모음의 [사진](PR #39)과 붙여넣기·끌어놓기가 그대로 맡는다.
- Q: 크기·개수는? → A: 파일당 10MB(사진과 같은 값, 앞단 nginx 12m 안), 글 하나에 5개. 설정값 `blog.attachment.*`.
- Q: 어떤 형식을 받나? → A: 받는 확장자 목록(문서·압축·사진·소리·영상)만 받는다. 실행 파일·스크립트·웹 문서(exe, sh, html, svg 등)는 받지 않는다. 내려받기는 항상 `application/octet-stream` + `Content-Disposition: attachment`라 브라우저가 열지 않는다.
- Q: 어디에 저장하나? → A: 사진 저장소(MinIO)의 같은 버킷, `attachments/` 아래. 사진(`images/*`)과 달리 익명 읽기를 열지 않고 앱이 권한을 확인한 뒤 전달한다. 파일 이름은 DB에만 두고 저장소 키는 무작위.
- Q: 언제 글에 붙나? → A: 고르는 즉시 올라가 그 글에 붙는다([임시저장]·[등록]과 별개, 017 카테고리 선택과 같은 방식). 등록된 글을 고치는 중에 붙이거나 지운 첨부도 바로 반영된다.
- Q: 누가 받을 수 있나? → A: 그 글을 볼 수 있는 사람(005·004 읽기 판정과 같음). 글 주인은 임시글·숨김 글의 첨부도 본다. 볼 수 없으면 이유를 구분하지 않고 404.

## User Scenarios & Testing

### User Story 1 - 글에 파일 첨부하기 (Priority: P1)

글쓰기 화면에서 [첨부파일]을 눌러 파일을 고르면 바로 올라가고, 본문 아래 "첨부파일 n/5" 목록에 이름과 크기가 보인다.

**Acceptance Scenarios**:

1. **Given** 글 주인이 글쓰기 화면을 열었을 때, **When** [첨부파일]로 PDF를 고르면, **Then** 목록에 원래 이름·크기가 나오고 본문은 바뀌지 않는다.
2. **Given** 실행 파일·웹 문서 등 받지 않는 형식이거나 10MB를 넘거나 빈 파일일 때, **When** 올리면, **Then** 400으로 거부되고 안내 문구가 나온다(화면이 먼저 막는다).
3. **Given** 첨부가 이미 5개일 때, **When** 하나 더 올리면, **Then** 409 `ATTACHMENT_LIMIT_EXCEEDED`.
4. **Given** 비회원·남의 글·인증 전 회원일 때, **When** 올리면, **Then** 401·404·403.

### User Story 2 - 글 읽기 화면에서 내려받기 (Priority: P1)

글 본문 아래(태그 위)에 "첨부파일 n" 목록이 있고, 이름을 누르면 원래 이름으로 저장된다.

**Acceptance Scenarios**:

1. **Given** 첨부가 있는 공개 글일 때, **When** 누구든 이름을 누르면, **Then** 원래 이름(한글 포함)으로 내려받는다.
2. **Given** 나만 보기·임시·숨김 글일 때, **When** 글 주인이 아닌 사람이 목록·내려받기를 요청하면, **Then** 404.
3. **Given** 저장소 주소를 알 때, **When** 저장소에서 바로 열면, **Then** 403(익명 읽기 없음).
4. **Given** 첨부가 없을 때, **Then** 목록을 그리지 않는다.

### User Story 3 - 첨부 지우기 (Priority: P2)

글쓰기 화면 목록의 [삭제]로 첨부를 뺀다. 글이 완전히 지워지면 첨부 파일도 정리된다.

**Acceptance Scenarios**:

1. **Given** 글 주인일 때, **When** [삭제]를 누르면, **Then** 목록과 저장소에서 사라진다.
2. **Given** 글이 완전 삭제(휴지통 비우기·탈퇴·빈 임시글 정리)될 때, **Then** 첨부 행은 함께 지워지고 매일 03:40 정리 작업이 저장소 파일을 지운다.

## Requirements

- **FR-001**: 글 주인만 첨부를 올리고 지운다. 올리기는 이메일 인증이 필요하다(`CONTENT_WRITE`), 지우기는 `CONTENT_CLEANUP`.
- **FR-002**: 목록·내려받기는 그 글을 볼 수 있는 사람만. 글 주인은 휴지통 밖이면 상태와 상관없이 본다.
- **FR-003**: 파일당 최대 `blog.attachment.max-bytes`(10MB, V4 CHECK와 같음).
- **FR-004**: 글당 최대 `blog.attachment.max-per-post`(5개). 동시에 올려도 넘지 않게 글 단위로 줄 세운다.
- **FR-005**: 받는 확장자는 `blog.attachment.allowed-extensions`. 1분에 `per-minute-limit`(20)개.
- **FR-006**: 원래 이름은 경로·제어 문자·앞뒤 점을 빼고 255자로 자른다(확장자 유지). 로그에 남기지 않는다.
- **FR-007**: 저장 키 `attachments/{yyyy}/{MM}/{uuid}`, 익명 읽기 없음.
- **FR-008**: 내려받기 응답은 `application/octet-stream`, `Content-Disposition: attachment; filename*=UTF-8''…`, `Cache-Control: no-store, private`, `X-Content-Type-Options: nosniff`.
- **FR-012**: 첨부 행이 어떤 경로로 지워지든 트리거가 키를 `attachment_trash`에 남기고, 직접 삭제는 바로, 나머지는 정리 작업이 저장소에서 지운다.

## Success Criteria

- **SC-001**: `AttachmentApiIT`(올리기·거부·개수·권한·삭제·정리), `FlywayBaselineIntegrationTest`(V4 반영), 화면 `attachments.test.tsx` 통과.
