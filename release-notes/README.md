# 릴리스 노트

버전마다 `vX.Y.Z.md` 파일 하나. main에 머지되면 `.github/workflows/release.yml`이 아직 없는 버전만 GitHub 릴리스(태그 포함)로 등록해요.

- 1.0.0: 첫 배포·출시 (2026-10-10, PR #1~#37)
- 그 뒤 버전: 배포 이후 수정사항

## 새 버전 추가하기

1. `release-notes/vX.Y.Z.md`를 만들고 첫 두 줄에 아래 주석을 넣어요.
   ```
   <!-- target: 이 버전 마지막 머지 커밋의 SHA 40자 -->
   <!-- title: BaseLOG X.Y.Z 배포 이후 수정사항 -->
   ```
2. 본문은 사용자 말로, PR 번호를 괄호에 적어요.
3. 루트 `CHANGELOG.md` 맨 위에 한 줄 요약을 더해요.
