#!/bin/bash
# =============================================================================
# Nexternel - Ubuntu Server Setup Script
# Package version: see VERSION at repo root.
# Run on your Ubuntu server after copying project files via FileZilla (SFTP)
#
# Usage:
#   chmod +x scripts/setup-server.sh
#   ./scripts/setup-server.sh
# =============================================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}=== Nexternel Server Setup ===${NC}"

# --- Check if running as root for docker install ---
if [ "$EUID" -eq 0 ]; then
    echo -e "${YELLOW}Warning: Running as root. Consider using a regular user in the docker group.${NC}"
fi

# --- Install Docker if missing ---
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER" 2>/dev/null || true
    echo -e "${GREEN}Docker installed. You may need to log out and back in for group changes.${NC}"
else
    echo -e "${GREEN}Docker already installed.${NC}"
fi

# --- Install Docker Compose plugin if missing ---
if ! docker compose version &> /dev/null; then
    echo -e "${YELLOW}Installing Docker Compose plugin...${NC}"
    sudo apt-get update
    sudo apt-get install -y docker-compose-plugin
fi

# --- Create .env from example if missing, or auto-fill placeholders ---
if [ ! -f .env ]; then
    chmod +x scripts/generate-env.sh 2>/dev/null || true
    ./scripts/generate-env.sh
    echo -e "${GREEN}Created .env with random passwords.${NC}"
elif grep -q 'change_me' .env 2>/dev/null; then
    echo -e "${YELLOW}.env still has placeholder passwords — generating fresh secrets...${NC}"
    BK=".env.bak.$(date +%s)"
    cp .env "$BK"
    chmod +x scripts/generate-env.sh 2>/dev/null || true
    ./scripts/generate-env.sh
    echo -e "${GREEN}Replaced .env (backup: $BK)${NC}"
fi

# Load MQTT credentials from .env
# shellcheck disable=SC1091
source "$(dirname "$0")/load-env.sh"

# --- Mosquitto password file: create once ---
# Never rebuild an existing one: after a restore it holds the old server's MQTT login, which the
# devices use (Nexternel keeps it in mosquitto/config/nexternel-mqtt-login.json).
if [ -s mosquitto/config/passwd ]; then
    echo -e "${GREEN}Mosquitto password file already present — kept.${NC}"
else
    echo -e "${YELLOW}Creating Mosquitto password file...${NC}"
    docker run --rm \
        --user "$(id -u):$(id -g)" \
        -v "$(pwd)/mosquitto/config:/mosquitto/config" \
        eclipse-mosquitto:2.1.2-alpine \
        mosquitto_passwd -b -c /mosquitto/config/passwd "${MQTT_USERNAME}" "${MQTT_PASSWORD}"
    chmod 644 mosquitto/config/passwd
    if [ ! -s mosquitto/config/passwd ]; then
        echo -e "${RED}ERROR: Failed to create mosquitto/config/passwd${NC}"
        exit 1
    fi
    echo -e "${GREEN}Mosquitto password file created.${NC}"
fi

# Remove retired one-off recovery scripts (upload does not delete old files on the server)
for obsolete in ensure-mosquitto-v4.sh fix-nodered-v4.sh diagnose-shelly-mqtt.sh live-installation-audit.sh \
    configure-nodered-token.sh backup-nexternel.sh; do
  rm -f "scripts/${obsolete}"
done
# Node-RED was removed in V5.2.76: its template folder is no longer used.
rm -rf nodered

# --- Build and start stack ---
echo -e "${YELLOW}Building and starting Docker containers (this may take several minutes)...${NC}"
docker compose up -d --build --remove-orphans

echo -e "${YELLOW}Waiting for services to become healthy...${NC}"
sleep 15

echo ""
echo -e "${GREEN}=== Setup Complete ===${NC}"
echo ""
echo "Open Nexternel in your browser:"
echo "  http://${SERVER_IP:-localhost}:${UI_PORT:-8080}"
echo ""
echo "On first visit, choose \"Start fresh\" (create your account) or \"Restore from backup\"."
echo "You do not need to edit .env, Mosquitto, or ESPHome files manually."
echo ""
