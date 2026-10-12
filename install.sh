#!/usr/bin/env bash
# =============================================================================
# Nexternel installer — on a fresh Ubuntu, Debian or Raspberry Pi OS (64-bit) machine:
#
#   curl -fsSL https://www.reynsys.com/install.sh | bash
#
# It installs Docker if needed, downloads Nexternel into ~/nexternel, creates all service
# passwords, starts everything, and prints the address to open. The browser then offers
# "Start fresh" or "Restore from backup".
#
# Options (environment variables):
#   NEXTERNEL_DIR      where to install (default: ~/nexternel)
#   NEXTERNEL_SOURCE   a release .tar.gz URL, a local .tar.gz file, or an unpacked folder
# =============================================================================
set -euo pipefail

# Filled in when releases are published on GitHub.
RELEASE_URL="https://github.com/reynsys/nexternel/releases/latest/download/nexternel.tar.gz"

DIR="${NEXTERNEL_DIR:-$HOME/nexternel}"
SOURCE="${NEXTERNEL_SOURCE:-$RELEASE_URL}"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m !\033[0m  %s\n' "$*"; }
die() { printf '\033[1;31m X\033[0m  %s\n' "$*" >&2; exit 1; }

# --- 1. Is this machine suitable? ---------------------------------------------------------
[ "$(uname -s)" = "Linux" ] || die "Nexternel installs on Linux (Ubuntu, Debian or Raspberry Pi OS)."
command -v apt-get >/dev/null 2>&1 || die "This installer supports Ubuntu, Debian and Raspberry Pi OS."
case "$(uname -m)" in
  x86_64 | aarch64 | arm64) ;;
  *) die "This machine's processor ($(uname -m)) is not supported: a 64-bit system is needed." ;;
esac
[ "$(id -u)" -ne 0 ] || die "Run this as your normal user, not as root. It asks for your password when it needs to."
[ ! -f "$DIR/docker-compose.yml" ] || die "Nexternel is already installed in $DIR."

MEM_MB=$(awk '/MemTotal/ { print int($2 / 1024) }' /proc/meminfo)
[ "$MEM_MB" -ge 1800 ] || warn "This machine has ${MEM_MB} MB of memory; 2 GB or more is recommended."
mkdir -p "$DIR"
FREE_MB=$(df -Pm "$DIR" | awk 'NR == 2 { print $4 }')
[ "$FREE_MB" -ge 8000 ] || warn "Only ${FREE_MB} MB of free disk space; 8 GB or more is recommended."

# --- 2. Tools and Docker (asks for the password only when something must be installed) ----
MISSING=()
for tool in curl openssl tar; do command -v "$tool" >/dev/null 2>&1 || MISSING+=("$tool"); done
if [ "${#MISSING[@]}" -gt 0 ]; then
  say "Installing ${MISSING[*]} (your password may be asked)…"
  sudo apt-get update -qq
  sudo apt-get install -y -qq "${MISSING[@]}"
fi

if ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker (your password may be asked)…"
  curl -fsSL https://get.docker.com | sudo sh
  sudo systemctl enable --now docker >/dev/null 2>&1 || true
fi
if ! docker compose version >/dev/null 2>&1; then
  say "Installing Docker Compose…"
  sudo apt-get install -y -qq docker-compose-plugin
fi
if ! id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
  say "Allowing $USER to run Docker…"
  sudo usermod -aG docker "$USER"
fi

# Run a command with Docker access — `sg` covers a group membership added in this session.
as_docker() {
  if docker info >/dev/null 2>&1; then bash -c "$1"; else sg docker -c "$1"; fi
}

# --- 3. Nexternel's files ---------------------------------------------------------------
say "Getting Nexternel…"
if [ -d "$SOURCE" ]; then
  cp -a "$SOURCE"/. "$DIR"/
elif [ -f "$SOURCE" ]; then
  tar -xzf "$SOURCE" -C "$DIR" --strip-components=1
else
  curl -fsSL "$SOURCE" | tar -xz -C "$DIR" --strip-components=1
fi
[ -f "$DIR/docker-compose.yml" ] || die "The download did not contain Nexternel ($SOURCE)."

# --- 4. Passwords, settings, and start ---------------------------------------------------
cd "$DIR"
say "Setting up and starting Nexternel (the first start takes several minutes)…"
as_docker "bash scripts/setup-server.sh"

# --- 5. Wait until it answers ------------------------------------------------------------
read_env() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '\r"'; }
SERVER_IP=$(read_env SERVER_IP)
UI_PORT=$(read_env UI_PORT)
API_PORT=$(read_env API_PORT)
say "Waiting for Nexternel to answer…"
for _ in $(seq 1 120); do
  if curl -sf -m 3 "http://127.0.0.1:${API_PORT:-4000}/api/v1/setup/status" >/dev/null; then
    echo
    say "Nexternel is installed."
    echo
    echo "   Open this address in a browser on any device at home:"
    echo
    echo "      https://${SERVER_IP:-this-machine}"
    echo
    echo "   The browser warns that the connection is not trusted until the device trusts"
    echo "   Nexternel's home certificate: continue past the warning this once, then use"
    echo "   Settings → System → Secure connection → Download home certificate."
    echo
    echo "   Then choose \"Start fresh\" or \"Restore from backup\"."
    echo
    echo "   Tip: in your router, reserve the address ${SERVER_IP:-of this machine} for it,"
    echo "   so it never changes — your devices find Nexternel by this address."
    echo
    exit 0
  fi
  sleep 3
done
die "Nexternel did not answer within 6 minutes. See: cd $DIR && docker compose ps"
