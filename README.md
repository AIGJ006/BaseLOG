# BaseLOG — 코드 저장소

티스토리 같은 개인 블로그 서비스 **BaseLOG**(https://baselog.java21.net)의 구현 코드입니다.

스펙·설계 문서(원문 docs, 기능별 specs, constitution, Spec Kit 명령)는 **[AIGJ006/BaseLOG_DOCS](https://github.com/AIGJ006/BaseLOG_DOCS)** 에 있습니다. 코드 주석의 `docs/NN`, `specs/NNN-기능` 경로는 그 저장소 기준입니다.

| 경로 | 내용 |
|---|---|
| [`backend/`](backend/) | Spring Boot + PostgreSQL + Flyway (모듈러 모놀리스) |
| [`frontend/`](frontend/) | React 화면 |
| [`deploy/`](deploy/) | 팀 공용 서버 배포 설정과 [안내](deploy/README.md) |
| [`.github/workflows/`](.github/workflows/) | main에 머지하면 서버로 자동 배포 (작업 흐름은 아래) |
| [`scripts/`](scripts/) | 테스트 계정·글 만들기 등 보조 스크립트 |
| `backend/src/test/resources/contracts/` | 테스트가 읽는 API 계약(openapi.yaml) 복사본. 문서 저장소의 계약을 바꾸면 여기도 같이 바꿉니다 |

## 내 컴퓨터에서 실행

```bash
cp .env.example .env      # 처음 한 번, 키 값 채우기
docker compose up -d --build
```

앱은 http://localhost:8080, 가입 인증 메일은 http://localhost:8025 (Mailpit)에서 봅니다. 끌 때는 `docker compose down`.

## 작업 흐름

- **`dev`**: 작업 브랜치. 기능·수정마다 브랜치를 만들어 **PR을 `dev`로** 머지합니다. dev에 머지해도 배포되지 않습니다.
- **`main`**: 배포 브랜치. 릴리스 때(평일 오후 6시, 주말은 주말 수정분을 묶어서) **`dev` → `main` PR** 하나로 머지하면 서버에 자동 배포됩니다. 이 PR에 그 버전의 릴리스 노트(`frontend/src/features/site-news/releases/vX.Y.Z.md`)를 함께 넣습니다.
- **되돌리기**: 배포한 버전에 문제가 생기면 `main`에서 그 릴리스 머지 커밋을 되돌리는(revert) PR을 머지합니다. 직전 버전으로 다시 배포됩니다. 고친 뒤 dev에서 다음 릴리스로 다시 올립니다.
- 급한 고침(사이트가 안 열리는 등)만 예외로 `main`에 바로 PR을 올리고, 머지 뒤 `main`을 `dev`에 합칩니다.

변경 기록은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.
