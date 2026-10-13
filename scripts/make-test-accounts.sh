#!/bin/bash
# BaseLOG 로컬 테스트 계정 2개 만들기 (docker compose up 상태에서, 저장소 폴더에서 실행)
# 사용: bash scripts/make-test-accounts.sh
set -e
BASE=http://localhost:8080
source "$(dirname "$0")/test-account-password.sh"
JAR=$(mktemp)

make_account() {
  local email=$1 handle=$2 nick=$3 pw=$4
  rm -f "$JAR"
  curl -sf -c "$JAR" "$BASE/api/auth/csrf" > /dev/null
  local token=$(grep XSRF-TOKEN "$JAR" | awk '{print $7}')
  local res=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/signup" \
    -H "Content-Type: application/json" -H "X-XSRF-TOKEN: $token" \
    -d "{\"email\":\"$email\",\"handle\":\"$handle\",\"password\":\"$pw\",\"passwordConfirm\":\"$pw\",\"nickname\":\"$nick\",\"agreements\":{\"termsVersion\":\"2026-10-07\",\"privacyVersion\":\"2026-10-07\"}}")
  echo "가입 $email → $res"
  docker compose exec -T postgres psql -U blog -d blog -c \
    "UPDATE auth_identity SET email_verified_at = now() WHERE email = '$email'" > /dev/null
  echo "  이메일 인증 처리 완료"
}

make_account test1@example.com tester1 '테스터1' "$TEST_ACCOUNT_PASSWORD"
make_account test2@example.com tester2 '테스터2' "$TEST_ACCOUNT_PASSWORD"
rm -f "$JAR"
echo
echo "완료! http://localhost:8080/login 에서 로그인하세요."
echo "  test1@example.com · test2@example.com (비밀번호는 .env의 TEST_ACCOUNT_PASSWORD)"
