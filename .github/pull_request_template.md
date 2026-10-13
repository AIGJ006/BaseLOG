## 무엇이 바뀌나요

Before:

After:

## 왜

## 확인한 것

- [ ] 백엔드를 바꿨다면 `cd backend && ./mvnw spotless:check` (틀리면 `spotless:apply`)
- [ ] 화면을 바꿨다면 `cd frontend && npm run lint && npm test`
- [ ] 로컬(`docker compose up -d --build`, http://localhost:8080)에서 직접 눌러 봄
- [ ] DB 마이그레이션(Flyway)이 있으면 추가만 했음 (옛 앱이 같은 DB로 계속 돌 수 있게)
- [ ] 화면 변경이면 캡처를 붙임
