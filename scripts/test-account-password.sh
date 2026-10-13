#!/bin/bash
# 테스트 계정 비밀번호 읽기 (make-test-accounts.sh·make-test-posts.sh가 source 한다).
# 비밀번호는 저장소에 두지 않는다. 순서: 환경변수 TEST_ACCOUNT_PASSWORD → .env의 TEST_ACCOUNT_PASSWORD → 직접 입력
if [ -z "${TEST_ACCOUNT_PASSWORD:-}" ] && [ -f .env ]; then
  TEST_ACCOUNT_PASSWORD=$(grep -E '^TEST_ACCOUNT_PASSWORD=' .env | tail -n 1 | cut -d= -f2-)
fi
if [ -z "${TEST_ACCOUNT_PASSWORD:-}" ]; then
  read -r -s -p "테스트 계정 비밀번호 (영문·숫자·기호 섞어 10자 이상): " TEST_ACCOUNT_PASSWORD
  echo
fi
if [ -z "$TEST_ACCOUNT_PASSWORD" ]; then
  echo "비밀번호가 없어요. .env에 TEST_ACCOUNT_PASSWORD=... 를 넣어 주세요"
  exit 1
fi
