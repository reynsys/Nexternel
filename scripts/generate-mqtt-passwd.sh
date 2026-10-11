#!/bin/bash
# Generate Mosquitto password file from .env
# Package version: see VERSION at repo root.
# Usage: ./scripts/generate-mqtt-passwd.sh
#
# If scripts fail with \r errors, run once:
#   find . -type f \( -name '*.sh' -o -name '.env' \) -exec sed -i 's/\r$//' {} +

set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Error: .env not found. Copy .env.example to .env and edit it first."
  exit 1
fi

read_env() {
  grep -E "^${1}=" .env | head -1 | sed 's/\r$//' | cut -d= -f2- | sed 's/^"//;s/"$//'
}

MQTT_USERNAME=$(read_env MQTT_USERNAME)
MQTT_PASSWORD=$(read_env MQTT_PASSWORD)

if [ -z "$MQTT_USERNAME" ] || [ -z "$MQTT_PASSWORD" ]; then
  echo "Error: MQTT_USERNAME and MQTT_PASSWORD must be set in .env"
  exit 1
fi

# Mosquitto refuses -c if passwd already exists (placeholder from upload or prior run)
if [ -f mosquitto/config/passwd ] && [ ! -w mosquitto/config/passwd ]; then
  sudo rm -f mosquitto/config/passwd
else
  rm -f mosquitto/config/passwd
fi

echo "Generating mosquitto/config/passwd for user: $MQTT_USERNAME"

if ! docker info >/dev/null 2>&1; then
  echo ""
  echo "Error: cannot talk to Docker (permission denied on /var/run/docker.sock)."
  echo "Your user was added to the 'docker' group, but this SSH session is still old."
  echo ""
  echo "Fix — pick one:"
  echo "  1) Log out of PuTTY completely, open a new session, then run this script again."
  echo "  2) Or in this session run:  newgrp docker"
  echo "     then:  ./scripts/generate-mqtt-passwd.sh"
  echo ""
  echo "Check group membership:  groups"
  echo "You should see 'docker' in the list."
  exit 1
fi

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -v "$(pwd)/mosquitto/config:/mosquitto/config" \
  eclipse-mosquitto:2.1.2-alpine \
  mosquitto_passwd -b -c /mosquitto/config/passwd "$MQTT_USERNAME" "$MQTT_PASSWORD"

# Docker as root leaves root-only files; --user avoids that, but fix if needed
if [ ! -O mosquitto/config/passwd ] 2>/dev/null; then
  sudo chown "$(id -u):$(id -g)" mosquitto/config/passwd
fi
chmod 644 mosquitto/config/passwd

echo "Done. Start or restart Mosquitto:"
echo "  docker compose up -d mosquitto"
