# BaseLOG — 코드 저장소

티스토리 같은 개인 블로그 서비스 **BaseLOG**(https://baselog.java21.net)의 구현 코드입니다.

스펙·설계 문서(원문 docs, 기능별 specs, constitution, Spec Kit 명령)는 **[AIGJ006/BaseLOG_DOCS](https://github.com/AIGJ006/BaseLOG_DOCS)** 에 있습니다. 코드 주석의 `docs/NN`, `specs/NNN-기능` 경로는 그 저장소 기준입니다.

| 경로 | 내용 |
|---|---|
| [`backend/`](backend/) | Spring Boot + PostgreSQL + Flyway (모듈러 모놀리스) |
| [`frontend/`](frontend/) | React 화면 |
| [`deploy/`](deploy/) | 팀 공용 서버 배포 설정과 [안내](deploy/README.md) |
| [`.github/workflows/`](.github/workflows/) | main에 머지하면 서버로 자동 배포 |
| [`scripts/`](scripts/) | 테스트 계정·글 만들기 등 보조 스크립트 |
| `backend/src/test/resources/contracts/` | 테스트가 읽는 API 계약(openapi.yaml) 복사본. 문서 저장소의 계약을 바꾸면 여기도 같이 바꿉니다 |

## 내 컴퓨터에서 실행

```bash
cp .env.example .env      # 처음 한 번, 키 값 채우기
docker compose up -d --build
```

앱은 http://localhost:8080, 가입 인증 메일은 http://localhost:8025 (Mailpit)에서 봅니다. 끌 때는 `docker compose down`.

변경 기록은 [CHANGELOG.md](CHANGELOG.md)에 있습니다.
