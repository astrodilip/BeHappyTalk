#!/bin/sh
# Uptime watchdog for the BeHappyTalk API. Runs from cron every minute.
#
#   * * * * * /var/www/behappytalk/scripts/healthcheck.sh >/dev/null 2>&1
#
# On 2026-07-27 the API process stopped and nothing restarted it, so the backend
# was down for three and a half weeks before anyone noticed. This script closes
# that specific hole: if the API stops answering it restarts it and records what
# happened. /bin/sh is dash on the VPS: POSIX only.
#
# cron runs with a minimal PATH and no HOME, but pm2 lives in /usr/local/bin and
# stores its process list under $HOME, so both must be set explicitly.
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
HOME=/root
export PATH HOME

set -eu

APP_DIR=/var/www/behappytalk
PM2_NAME=behappytalk-server
LOG=/var/log/behappytalk-uptime.log
MAX_LOG_LINES=500

PORT=$(sed -n 's/^PORT=[^0-9]*\([0-9][0-9]*\).*/\1/p' "$APP_DIR/server/.env" 2>/dev/null | tail -1 || true)
PORT=${PORT:-5050}
URL="http://127.0.0.1:$PORT/api/providers"

probe() {
  curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$URL" 2>/dev/null || echo 000
}

CODE=$(probe)
[ "$CODE" = "200" ] && exit 0

# A deploy reload drops requests for a second or two. Re-probe before acting so
# the watchdog never fights a deploy that is already bringing the API back.
sleep 10
CODE=$(probe)
[ "$CODE" = "200" ] && exit 0

TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
echo "$TS API down (HTTP $CODE) - restarting $PM2_NAME" >> "$LOG"

if pm2 describe "$PM2_NAME" > /dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env >> "$LOG" 2>&1 || true
else
  echo "$TS no pm2 process named $PM2_NAME - starting it" >> "$LOG"
  cd "$APP_DIR/server" && pm2 start server.js --name "$PM2_NAME" >> "$LOG" 2>&1 || true
fi
# Persist the process list so a reboot brings the API back on its own.
pm2 save > /dev/null 2>&1 || true

sleep 10
CODE=$(probe)
if [ "$CODE" = "200" ]; then
  echo "$TS recovered after restart" >> "$LOG"
else
  echo "$TS STILL DOWN after restart (HTTP $CODE) - needs a human" >> "$LOG"
  pm2 logs "$PM2_NAME" --lines 20 --nostream >> "$LOG" 2>&1 || true
fi

# Keep the log bounded so it cannot fill the disk.
if [ -f "$LOG" ]; then
  tail -n "$MAX_LOG_LINES" "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
fi
