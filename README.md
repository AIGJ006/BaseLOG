# BaseLOG — 코드 저장소

티스토리 같은 개인 블로그 서비스 **BaseLOG**(https://baselog.java21.net)의 구현 코드입니다.

스펙·설계 문서(원문 docs, 기능별 specs, constitution, Spec Kit 명령)는 **[AIGJ006/BaseLOG_DOCS](https://github.com/AIGJ006/BaseLOG_DOCS)** 에 있습니다. 코드 주석의 `docs/NN`, `specs/NNN-기능` 경로는 그 저장소 기준입니다.

| 경로 | 내용 |
|---|---|
| [`backend/`](backend/) | Spring Boot + PostgreSQL + Flyway (모듈러 모놀리스) |
| [`frontend/`](frontend/) | React 화면 |
| [`deploy/`](deploy/) | 팀 공용 서버 배포 설정과 [안내](deploy/README.md) |
| [`.github/workflows/`](.github/workflows/) | CI(PR마다 시험), main에 머지(릴리스)하면 서버로 무중단 자동 배포 (작업 흐름은 아래) |
| [`scripts/`](scripts/) | 테스트 계정·글 만들기 등 보조 스크립트 |
| `backend/src/test/resources/contracts/` | 테스트가 읽는 API 계약(openapi.yaml) 복사본. 문서 저장소의 계약을 바꾸면 여기도 같이 바꿉니다 |

## 내 컴퓨터에서 실행

```bash
cp .env.example .env      # 처음 한 번, 키 값 채우기
docker compose up -d --build
```

앱은 http://localhost:8080, 가입 인증 메일은 http://localhost:8025 (Mailpit)에서 봅니다. 끌 때는 `docker compose down`.

## 작업 흐름 (Git Flow)

Git Flow를 우리 배포 방식에 맞춰 씁니다. 자세한 개발 환경은 [DEVELOPMENT.md](DEVELOPMENT.md).

```
feature/*  ──PR──▶  dev  ──(평일 17:45 릴리스)──▶ release/vX.Y.Z ──PR──▶ main
                     ▲                                                  │
hotfix/*  ──PR──────┴──────────────────────────────────────────PR───────┘
```

| 브랜치 | 만드는 곳 | 합치는 곳 | 하는 일 |
|---|---|---|---|
| `main` | — | — | 실제 사이트에 올라간 버전. 릴리스 때만 바뀌고, **머지하면 실제 사이트에 무중단 배포**됩니다(시험은 PR에서 통과한 것으로 갈음) |
| `dev` | — | — | 개발 브랜치(Git Flow의 develop). 서버에는 올리지 않고 로컬에서 확인합니다([DEVELOPMENT.md](DEVELOPMENT.md)) |
| `feature/<이름>` | dev | dev (PR) | 기능·화면·버그 수정 하나. 예: `feature/friend-visibility` |
| `release/vX.Y.Z` | dev | main (PR) | 릴리스 노트(`frontend/src/features/site-news/releases/vX.Y.Z.md`)를 넣은 dev를 main에 올립니다. 머지 뒤 이 브랜치는 자동으로 지워집니다(그래서 dev를 직접 head로 쓰지 않습니다) |
| `hotfix/<이름>` | main | dev와 main (PR 두 개) | 사이트가 안 열리는 등 급한 고침 |

- **PR 규칙**: 모든 PR은 CI(`.github/workflows/ci.yml` — 백엔드 `./mvnw verify`, 화면 lint·test·build)가 초록이어야 머지합니다. 바뀐 쪽만 시험해요(화면만 바꾸면 백엔드 시험은 건너뜀).
- **버전**: 평소 수정은 끝자리(1.1.0 → 1.1.1), 큰 기능은 가운데 자리(1.1 → 1.2). 평일 17:45, 주말 수정분은 월요일에 묶습니다.
- **되돌리기**: main에서 문제의 릴리스 머지를 되돌리는(revert) PR을 머지하면 직전 버전으로 무중단 재배포됩니다. 이 변경 뒤에 만든 릴리스 태그(1.1.0 다음부터)는 Actions → deploy → Run workflow에서 태그를 골라 바로 다시 배포할 수도 있어요.

변경 기록은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.
