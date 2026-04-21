#!/bin/sh
set -e

mkdir -p /app/data/media

[ -f /app/data/commands.json ] || echo '[]' > /app/data/commands.json
[ -f /app/data/ignored.json ]  || echo '[]' > /app/data/ignored.json
[ -f /app/data/alerts.json ]   || echo '{"subSound":null,"subVolume":1,"subEnabled":true}' > /app/data/alerts.json

exec "$@"
