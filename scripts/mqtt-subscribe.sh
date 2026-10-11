#!/bin/bash
# Subscribe to Nexternel MQTT topics (reads credentials from .env).
# Package version: see VERSION at repo root.
# Usage: ./scripts/mqtt-subscribe.sh
#
# Fix CRLF after FTP upload:
#   sed -i 's/\r$//' .env scripts/*.sh

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Error: .env not found. Copy .env.example to .env in the project root."
  exit 1
fi

read_env() {
  grep -E "^${1}=" .env | head -1 | sed 's/\r$//' | cut -d= -f2- | sed 's/^"//;s/"$//'
}

MQTT_USERNAME=$(read_env MQTT_USERNAME)
MQTT_PASSWORD=$(read_env MQTT_PASSWORD)
MQTT_TOPIC_PREFIX=$(read_env MQTT_TOPIC_PREFIX)
MQTT_TOPIC_PREFIX="${MQTT_TOPIC_PREFIX:-nexternel}"

if [ -z "$MQTT_USERNAME" ] || [ -z "$MQTT_PASSWORD" ]; then
  echo "Error: MQTT_USERNAME and MQTT_PASSWORD must be set in .env"
  exit 1
fi

echo "Listening on ${MQTT_TOPIC_PREFIX}/# (Ctrl+C to stop)..."
docker compose exec mosquitto mosquitto_sub \
  -h localhost \
  -u "$MQTT_USERNAME" \
  -P "$MQTT_PASSWORD" \
  -t "${MQTT_TOPIC_PREFIX}/#" \
  -v
