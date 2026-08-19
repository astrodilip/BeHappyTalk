#!/bin/sh
# Server-side half of the VPS deploy. Run from the repo root AFTER the working
# tree has been reset to the revision being deployed:
#
#   cd /var/www/behappytalk && git fetch origin main && git reset --hard origin/main && sh scripts/deploy.sh
#
# Keeping the logic here (rather than inline in the workflow) means the CI SSH
# session only has to carry one short command, so a dropped connection cannot
# kill the deploy halfway through. /bin/sh is dash on this box: POSIX only, no
# pipefail, no [[ ]], no arrays.
set -eu

APP_DIR=$(cd "$(dirname "$0")/.." && pwd)
SERVER_DIR="$APP_DIR/server"
PM2_NAME=behappytalk-server

echo "Deploying $(git -C "$APP_DIR" rev-parse --short HEAD) from $APP_DIR"

cd "$SERVER_DIR"

# Only touch dependencies when the lockfile for THIS deploy differs from what
# was installed last time, and use npm ci so a deploy can never pull in an
# untested version the way npm install can.
LOCK_STAMP=$APP_DIR/.deploy-lock-hash
LOCK_NOW=$(git -C "$APP_DIR" hash-object server/package-lock.json 2>/dev/null || echo none)
LOCK_LAST=none
if [ -f "$LOCK_STAMP" ]; then
  LOCK_LAST=$(cat "$LOCK_STAMP")
fi

if [ "$LOCK_NOW" != "$LOCK_LAST" ]; then
  echo "Lockfile changed ($LOCK_LAST -> $LOCK_NOW) - installing with npm ci"
  npm ci --omit=dev
  printf '%s' "$LOCK_NOW" > "$LOCK_STAMP"
else
  echo "Lockfile unchanged - skipping dependency install"
fi

# reload only works on an already-registered process; start it otherwise.
if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  echo "Reloading pm2 process $PM2_NAME"
  pm2 reload "$PM2_NAME" --update-env
else
  echo "No pm2 process named $PM2_NAME - starting it"
  pm2 start server.js --name "$PM2_NAME"
fi
# Persist the process list so a reboot brings the API back by itself.
pm2 save

PORT=$(sed -n 's/^PORT=[^0-9]*\([0-9][0-9]*\).*/\1/p' .env 2>/dev/null | tail -1 || true)
PORT=${PORT:-5050}

echo "Health checking http://127.0.0.1:$PORT/api/providers"
attempt=1
while [ "$attempt" -le 10 ]; do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
    "http://127.0.0.1:$PORT/api/providers" 2>/dev/null) || CODE=000
  if [ "$CODE" = "200" ]; then
    echo "Health check passed on attempt $attempt"
    exit 0
  fi
  echo "Attempt $attempt: HTTP $CODE - retrying in 5s"
  attempt=$((attempt + 1))
  sleep 5
done

echo "Health check failed - the API is not answering after the reload"
echo "Recent process output:"
pm2 logs "$PM2_NAME" --lines 40 --nostream || true
exit 1
