#!/bin/sh
# 서버에서 실행하는 배포 스크립트 (GitHub Actions deploy.yml이 ~/buildlog/ 로 복사한 뒤 부른다).
# 손으로 다시 실행해도 된다:  cd ~/buildlog && sh deploy.sh
#   1) buildlog-app.tar.gz 가 있으면 docker load (태그: 커밋 sha, latest)
#   2) .env 확인(권한 600), SITE_URL에서 SITE_HOST·SITE_SCHEME 계산
#   3) minio-init(버킷·정책·앱 키, 여러 번 실행해도 같음) → redis·minio·edge up -d
#   4) 무중단 배포(blue·green): 지금 쉬고 있는 색(app-blue|app-green)에 새 이미지를 띄우고 /api/agreements/current 200을
#      기다린 뒤, edge가 보낼 곳(edge-active/upstream.conf)을 바꿔 nginx -s reload → 옛 색을 끈다.
#      새 앱이 안 뜨면 옛 앱을 그대로 두고 실패로 끝난다(사이트는 계속 옛 버전).
#   상태는 .deploy-state(ACTIVE_COLOR·APP_BLUE_TAG·APP_GREEN_TAG)에 남는다. DB 변경(Flyway)은 새 앱이 뜰 때 반영되고
#   그동안 옛 앱도 같은 DB를 쓰므로, 마이그레이션은 옛 코드가 깨지지 않게(컬럼·테이블 추가 위주) 쓴다.
# 비밀값을 출력하지 않는다 (.env를 cat 하거나 set -x 하지 말 것).
set -eu

cd "$(dirname "$0")"

COMPOSE_FILE=docker-compose.prod.yml
IMAGE_ARCHIVE=buildlog-app.tar.gz

if [ ! -f .env ]; then
  echo "deploy: .env가 없습니다 (GitHub Actions가 만들어 넣습니다 — deploy/README.md)" >&2
  exit 1
fi
chmod 600 .env

# docker compose v2 플러그인이 없으면 단독 실행 파일(docker-compose, v2 이상)로 대신한다
if docker compose version >/dev/null 2>&1; then
  dc() { docker compose -p buildlog --env-file .env -f "$COMPOSE_FILE" "$@"; }
elif command -v docker-compose >/dev/null 2>&1; then
  dc() { docker-compose -p buildlog --env-file .env -f "$COMPOSE_FILE" "$@"; }
else
  echo "deploy: docker compose(또는 docker-compose)가 없습니다" >&2
  exit 1
fi

# .env에서 비밀이 아닌 값 몇 개만 읽는다 (값 전체를 셸에 source 하지 않는다 — 특수 문자 안전)
env_value() {
  sed -n "s/^$1=//p" .env | tail -n 1 | sed "s/^'\(.*\)'\$/\1/; s/^\"\(.*\)\"\$/\1/"
}
SITE_URL=$(env_value SITE_URL)
APP_PORT=$(env_value APP_PORT)
if [ -z "$SITE_URL" ] || [ -z "$APP_PORT" ]; then
  echo "deploy: .env에 SITE_URL·APP_PORT가 필요합니다" >&2
  exit 1
fi
SITE_SCHEME=${SITE_URL%%://*}
SITE_HOST=${SITE_URL#*://}
SITE_HOST=${SITE_HOST%%/*}
export SITE_SCHEME SITE_HOST

if [ -f "$IMAGE_ARCHIVE" ]; then
  echo "deploy: 이미지 불러오는 중"
  gunzip -c "$IMAGE_ARCHIVE" | docker load
  rm -f "$IMAGE_ARCHIVE"
fi
APP_IMAGE_TAG=${APP_IMAGE_TAG:-latest}
export APP_IMAGE_TAG
docker image inspect "buildlog-app:$APP_IMAGE_TAG" >/dev/null 2>&1 || {
  echo "deploy: 이미지 buildlog-app:$APP_IMAGE_TAG 가 없습니다" >&2
  exit 1
}

echo "deploy: 설정 확인"
dc config --quiet

case "$(env_value COMPOSE_PROFILES)" in
  *localdb*)
    echo "deploy: 서버 안 PostgreSQL(profile localdb) 준비"
    dc up -d --wait postgres
    ;;
esac

echo "deploy: 저장소 준비 (minio-init)"
dc up -d --wait redis minio
dc run --rm minio-init

# ---- 무중단 배포 (blue·green) ----
STATE_FILE=.deploy-state
state_value() {
  [ -f "$STATE_FILE" ] && sed -n "s/^$1=//p" "$STATE_FILE" | tail -n 1
}
ACTIVE_COLOR=$(state_value ACTIVE_COLOR || true)
APP_BLUE_TAG=$(state_value APP_BLUE_TAG || true)
APP_GREEN_TAG=$(state_value APP_GREEN_TAG || true)
APP_BLUE_TAG=${APP_BLUE_TAG:-latest}
APP_GREEN_TAG=${APP_GREEN_TAG:-latest}
if [ "$ACTIVE_COLOR" = blue ]; then NEW_COLOR=green; OLD_COLOR=blue; else NEW_COLOR=blue; OLD_COLOR=green; fi
if [ "$NEW_COLOR" = blue ]; then APP_BLUE_TAG=$APP_IMAGE_TAG; else APP_GREEN_TAG=$APP_IMAGE_TAG; fi
export APP_BLUE_TAG APP_GREEN_TAG

# 예전 배포(색 구분 전)의 app 컨테이너. 처음 한 번만 있고, 전환이 끝나면 지운다
LEGACY_APP=$(docker ps -aq --filter label=com.docker.compose.project=buildlog --filter label=com.docker.compose.service=app)

mkdir -p edge-active
write_upstream() {
  printf 'set $app_upstream %s:8080;\n' "$1" > edge-active/upstream.conf.tmp
  mv edge-active/upstream.conf.tmp edge-active/upstream.conf
}
if [ ! -f edge-active/upstream.conf ]; then
  # 처음: 지금 떠 있는 앱(예전 app 또는 켜진 색)을 그대로 가리킨 채로 edge를 올린다
  if [ -n "$LEGACY_APP" ]; then write_upstream app; else write_upstream "app-$OLD_COLOR"; fi
fi

echo "deploy: edge 준비 (설정이 바뀐 경우에만 다시 만든다)"
dc up -d --no-deps edge

echo "deploy: 새 앱 띄우는 중 (app-$NEW_COLOR, 이미지 buildlog-app:$APP_IMAGE_TAG). 지금 손님은 그대로 옛 앱이 받는다"
dc up -d --no-deps --force-recreate "app-$NEW_COLOR"

echo "deploy: 새 앱 기동 확인 (최대 240초)"
ok=false
i=0
while [ $i -lt 120 ]; do
  if dc exec -T edge wget -q -O /dev/null -T 5 --header "Host: $SITE_HOST" --header "X-Forwarded-Proto: $SITE_SCHEME" \
      "http://app-$NEW_COLOR:8080/api/agreements/current" 2>/dev/null; then
    ok=true
    break
  fi
  i=$((i + 1))
  sleep 2
done
if [ "$ok" != true ]; then
  echo "deploy: 새 앱(app-$NEW_COLOR)이 240초 안에 응답하지 않았습니다. 옛 앱을 그대로 둡니다. 최근 로그:" >&2
  dc logs --tail 80 "app-$NEW_COLOR" >&2 || true
  dc stop "app-$NEW_COLOR" >&2 || true
  exit 1
fi

echo "deploy: 손님을 app-$NEW_COLOR로 넘기는 중 (nginx reload, 끊김 없음)"
write_upstream "app-$NEW_COLOR"
dc exec -T edge nginx -t
dc exec -T edge nginx -s reload

# 바깥 길(127.0.0.1:APP_PORT → edge → 새 앱)로 한 번 더 확인
i=0
code=""
while [ $i -lt 15 ]; do
  code=$(curl -s -o /dev/null -w '%{http_code}' -H "Host: $SITE_HOST" -H "X-Forwarded-Proto: $SITE_SCHEME" \
    "http://127.0.0.1:$APP_PORT/api/agreements/current" || true)
  [ "$code" = "200" ] && break
  i=$((i + 1))
  sleep 2
done
if [ "$code" != "200" ]; then
  echo "deploy: 전환 뒤 사이트가 응답하지 않아($code) 옛 앱으로 되돌립니다" >&2
  if [ -n "$LEGACY_APP" ]; then write_upstream app; else write_upstream "app-$OLD_COLOR"; fi
  dc exec -T edge nginx -s reload || true
  dc stop "app-$NEW_COLOR" >&2 || true
  exit 1
fi

printf 'ACTIVE_COLOR=%s\nAPP_BLUE_TAG=%s\nAPP_GREEN_TAG=%s\n' "$NEW_COLOR" "$APP_BLUE_TAG" "$APP_GREEN_TAG" > "$STATE_FILE"

echo "deploy: 옛 앱 정리 (진행 중인 요청이 끝나도록 15초 기다린 뒤)"
sleep 15
dc stop "app-$OLD_COLOR" >/dev/null 2>&1 || true
if [ -n "$LEGACY_APP" ]; then
  docker rm -f $LEGACY_APP >/dev/null 2>&1 || true
fi

echo "deploy: 완료 — app-$NEW_COLOR가 응답합니다 ($SITE_URL)"
dc ps
# 옛 앱 이미지 정리: 두 색이 쓰는 태그와 latest만 남긴다 (볼륨·다른 서비스 이미지는 건드리지 않음)
docker image ls buildlog-app --format '{{.Tag}}' | while read -r tag; do
  [ "$tag" = latest ] || [ "$tag" = "$APP_BLUE_TAG" ] || [ "$tag" = "$APP_GREEN_TAG" ] || docker image rm "buildlog-app:$tag" >/dev/null 2>&1 || true
done
docker image prune -f >/dev/null 2>&1 || true
exit 0
