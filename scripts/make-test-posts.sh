#!/bin/bash
# BaseLOG 로컬 테스트 글 5개 발행 (docker compose up 상태에서 실행)
# 먼저 scripts/make-test-accounts.sh로 테스트 계정(test1·test2)을 만들어 둬야 한다.
# 사용: bash scripts/make-test-posts.sh
# 로컬(http://localhost:8080)에만 들어간다. 배포 서버와는 상관없다.
set -e
BASE=${BASE:-http://localhost:8080}
PW='Test-Pass-2026!'
JAR=$(mktemp)
trap 'rm -f "$JAR"' EXIT

new_key() { if command -v uuidgen >/dev/null; then uuidgen | tr A-Z a-z; else cat /proc/sys/kernel/random/uuid; fi; }
token() { grep XSRF-TOKEN "$JAR" | tail -n 1 | awk '{print $7}'; }

login() {
  rm -f "$JAR"
  curl -sf -c "$JAR" "$BASE/api/auth/csrf" > /dev/null || {
    echo "앱에 접속이 안 돼요. docker compose up -d 로 먼저 켜 주세요"; exit 1; }
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" -X POST "$BASE/api/auth/login" \
    -H "X-XSRF-TOKEN: $(token)" --data-urlencode "email=$1" --data-urlencode "password=$PW")
  if [ "$code" != 200 ]; then
    echo "$1 로그인 실패(코드 $code). 먼저 bash scripts/make-test-accounts.sh 를 실행해 주세요"; exit 1
  fi
  curl -sf -b "$JAR" -c "$JAR" "$BASE/api/auth/csrf" > /dev/null
  echo "$1 로그인"
}

# publish "제목" "본문(마크다운, 줄바꿈은 \n)" '"태그1","태그2"'
publish() {
  local res id
  res=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/posts" \
    -H "Content-Type: application/json" -H "X-XSRF-TOKEN: $(token)" -d '{}')
  id=$(printf '%s' "$res" | sed -n 's/.*"postId":\([0-9]*\).*/\1/p')
  if [ -z "$id" ]; then echo "  새 글 만들기 실패: $res"; exit 1; fi
  res=$(curl -s -b "$JAR" -c "$JAR" -X POST "$BASE/api/posts/$id/publish" \
    -H "Content-Type: application/json" -H "X-XSRF-TOKEN: $(token)" -H "Idempotency-Key: $(new_key)" \
    -d "{\"title\":\"$1\",\"contentMd\":\"$2\",\"tags\":[$3],\"visibility\":\"PUBLIC\",\"baseVersion\":0}")
  if printf '%s' "$res" | grep -q '"errors"'; then echo "  발행 실패 ($1): $res"; exit 1; fi
  echo "  발행: $1"
}

login test1@example.com
publish "BaseLOG 첫 글입니다" \
  "## 안녕하세요\n\nBaseLOG에 처음 올리는 테스트 글이에요.\n\n- 글쓰기\n- 카테고리\n- 댓글과 좋아요\n\n앞으로 잘 부탁드려요!" \
  '"공지","시작"'
publish "스프링 부트로 블로그 만들기" \
  "스프링 부트와 리액트로 블로그를 만들고 있어요.\n\n\`\`\`java\n@GetMapping(\\\"/hello\\\")\npublic String hello() {\n    return \\\"hello\\\";\n}\n\`\`\`\n\n코드 블록도 잘 보이는지 확인해 보세요." \
  '"spring","개발"'
publish "주말 카페 기록" \
  "주말에 다녀온 카페 이야기예요.\n\n> 커피가 맛있고 조용해서 공부하기 좋았어요.\n\n다음에 또 가 볼 생각이에요." \
  '"일상","카페"'

login test2@example.com
publish "테스터2의 첫 글" \
  "테스터2 계정으로 쓴 글이에요.\n\n친구·피드 확인용으로 써 보세요." \
  '"테스트"'
publish "도커로 로컬 개발 환경 띄우기" \
  "1. 저장소 폴더로 이동\n2. git pull\n3. docker compose up -d --build\n\n이렇게 하면 앱이 http://localhost:8080 에서 열려요." \
  '"docker","개발"'

echo
echo "완료! http://localhost:8080 홈에서 새 글 5개를 확인하세요."
