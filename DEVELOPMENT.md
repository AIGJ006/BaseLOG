# 개발 환경

BaseLOG를 내 컴퓨터에서 돌리고 고치는 데 필요한 것을 정리했어요. 작업 브랜치 규칙은 [README "작업 흐름"](README.md#작업-흐름-git-flow), 서버 배포는 [deploy/README.md](deploy/README.md)에 있어요.

## 1. 기술 스택

| 영역 | 쓰는 것 | 버전 |
|---|---|---|
| 백엔드 | Java, Spring Boot (모듈러 모놀리스), Spring Security(세션 + OAuth2 로그인), Spring Data JPA·JdbcClient | Java 21, Spring Boot 4.1 |
| DB | PostgreSQL + Flyway(마이그레이션 `backend/src/main/resources/db/migration/V*.sql`), pg_trgm | PostgreSQL 18 |
| 캐시·세션 | Redis (로그인 세션, 조회수·요청 횟수 제한, 인기 글) | Redis 7 |
| 파일 저장 | MinIO (S3 호환, 사진·첨부파일) | pgsty/silo 2026-09-16 |
| 메일 | 로컬은 Mailpit, 서버는 Gmail SMTP | — |
| AI 태그 추천 | Gemini API (없으면 로컬 Ollama `qwen2.5:1.5b`) | Ollama 0.34 |
| 화면 | React + TypeScript + Vite, React Router | React 18, TS 6, Vite 8 |
| 시험 | JUnit 5 + Testcontainers(백엔드), Vitest + Testing Library(화면), Playwright(E2E) | — |
| 배포 | Docker, GitHub Actions(CI·CD), nginx(edge), blue·green 무중단 배포 | — |

### 백엔드 모듈 (`backend/src/main/java/com/team/blog/`)

`account`(회원·로그인·친구) · `post`(글쓰기·공개 범위) · `category` · `tag` · `media`(사진·첨부파일) · `interaction`(댓글·좋아요·조회수) · `discovery`(홈·검색·인기 글·피드) · `notification` · `moderation`(신고·숨김·정지) · `shared`(보안·오류 응답 등 공통). 모듈끼리는 서로의 `application` 공개 서비스만 부릅니다.

### 화면 (`frontend/src/`)

`pages/`(주소별 화면) · `features/`(기능별 부품) · `components/`(공통 부품) · `api/`(서버 호출) · `styles/`(`tokens.css` 색 토큰 — 화면 코드에 색 값을 직접 쓰지 않고, 라이트·다크 쌍으로 토큰을 더합니다).

## 2. 준비물

- **Docker Desktop** (필수) — 앱·DB·Redis·MinIO·Mailpit·Ollama가 전부 컨테이너로 떠요
- 코드를 고칠 때만: **JDK 21**(Temurin 권장), **Node.js 22**, Git
- 에디터: IntelliJ IDEA(백엔드), VS Code(화면) 등 아무거나

## 3. 처음 실행하기

```bash
git clone https://github.com/AIGJ006/BaseLOG.git
cd BaseLOG
cp .env.example .env          # 키 값 채우기 (아래 표)
docker compose up -d --build  # 처음엔 몇 분 걸려요. Ollama 모델(약 1GB)은 뒤에서 받아요
```

| 주소 | 내용 |
|---|---|
| http://localhost:8080 | 사이트 |
| http://localhost:8025 | Mailpit (가입 인증 메일 확인) |

테스트 계정·글이 필요하면 `sh scripts/make-test-accounts.sh` → `sh scripts/make-test-posts.sh` (계정 `test1@example.com` / `test2@example.com`).

새 코드를 받아 다시 띄울 때는 `git pull` → `docker compose up -d --build`, 끌 때는 `docker compose down` (`-v`를 붙이면 데이터까지 지워져요).

### `.env` 키 (비워 두면 그 기능만 꺼져요)

| 키 | 쓰는 곳 |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 구글 로그인 (redirect: `http://localhost:8080/login/oauth2/code/google`) |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | 깃허브 로그인 (callback: `http://localhost:8080/login/oauth2/code/github`) |
| `GEMINI_API_KEY` | AI 태그 추천 (없으면 Ollama) |

비밀값은 `.env`(커밋 안 됨)와 GitHub Secrets에만 둡니다. 채팅·이슈에 붙이지 않아요.

## 4. 코드 고치면서 돌리기

| 하고 싶은 것 | 명령 (폴더) |
|---|---|
| 화면만 빠르게 보기 (저장하면 바로 반영) | `npm ci` 한 번 → `npm run dev` (`frontend/`, http://localhost:5173, API는 8080 앱으로 넘김) |
| 화면 시험·린트·빌드 | `npm test` · `npm run lint` · `npm run build` (`frontend/`) |
| 백엔드 시험 전체 | `./mvnw verify` (`backend/`, Docker가 켜져 있어야 함 — Testcontainers가 DB·Redis·MinIO를 띄워요) |
| 코드 모양 맞추기 | `./mvnw spotless:apply` (`backend/`) · `npm run format` (`frontend/`) |
| E2E | `npm run test:e2e` (`frontend/`, 앱이 떠 있어야 함) |

PR을 올리면 GitHub Actions의 **ci**가 같은 시험(백엔드 verify, 화면 lint·test·build) 중 바뀐 쪽을 돌려요. 초록이 돼야 머지합니다.

코드 품질은 **sonar** 워크플로가 PR과 dev 머지 때 SonarQube 서버(프로젝트 키 `BaseLOG`)로 분석해요. 결과는 SonarQube 화면에서 보고, 이 검사는 배포를 막지 않아요. 서버는 http://s4.java21.net:9000, 필요한 Secret은 `SONAR_TOKEN`. 커버리지(백엔드 JaCoCo, 화면 `npm run test:coverage`)도 함께 올라가요. 로컬에서 화면 커버리지만 보려면 `frontend/`에서 `npm run test:coverage`.

## 5. 서버 구성 (참고)

```
브라우저 → 클라우드플레어(https) → 서버 nginx(baselog.java21.net)
        → edge 컨테이너(127.0.0.1:8350) ─┬─ /blog/* → minio
                                          └─ 나머지 → app-blue 또는 app-green
                                                       ├─ postgres
                                                       └─ redis
```

- dev에 머지하면 GitHub Actions **deploy**가 도커 이미지를 만들어 서버에 올리고, 쉬고 있는 색(blue/green)에 새 앱을 띄운 뒤 edge가 보낼 곳을 바꿔요. 새 앱이 안 뜨면 옛 앱이 계속 손님을 받아요.
- DB 변경은 새 앱이 뜰 때 Flyway가 반영하고, 그동안 옛 앱도 같은 DB를 쓰므로 마이그레이션은 **컬럼·테이블 추가 위주**로(옛 코드가 깨지지 않게) 씁니다.
- 서버 점검은 Actions → **diagnose**, 관리자 지정은 **make-admin** (둘 다 손으로 실행).
