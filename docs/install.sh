#!/usr/bin/env bash
# =============================================================================
# Nexternel installer — on a fresh Ubuntu, Debian or Raspberry Pi OS (64-bit) machine:
#
#   curl -fsSL https://www.nexternel.com/install.sh | bash
#
# It installs Docker if needed, downloads Nexternel into ~/nexternel, creates all service
# passwords, starts everything, and prints the address to open. The screen shows a few short steps;
# everything technical goes to ~/nexternel-install.log. The browser then runs the setup wizard.
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

# Everything technical goes to this file; the screen shows only short steps (and the file on failure).
LOG="$HOME/nexternel-install.log"
: >"$LOG"
chmod 600 "$LOG"

say() { printf '  %s\n' "$*"; }
warn() { printf '  \033[1;33m!\033[0m %s\n' "$*"; }
die() {
  printf '\n  \033[1;31m✗\033[0m %s\n' "$1" >&2
  printf '    The details are in %s\n\n' "$LOG" >&2
  exit 1
}
# step "What it does" "What to do if it fails" command…  — one line on screen, the output in the log.
step() {
  local text="$1" fix="$2"
  shift 2
  printf '  … %s' "$text"
  echo "=== $text" >>"$LOG"
  if "$@" >>"$LOG" 2>&1; then
    printf '\r  \033[1;32m✓\033[0m %s\n' "$text"
  else
    printf '\r  \033[1;31m✗\033[0m %s\n' "$text"
    die "$fix"
  fi
}

printf '\n  \033[1mInstalling Nexternel\033[0m\n\n'

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

step "Checking this machine" "This machine is not ready for Nexternel." true

# --- 2. Tools and Docker (asks for the password only when something must be installed) ----
MISSING=()
for tool in curl openssl tar; do command -v "$tool" >/dev/null 2>&1 || MISSING+=("$tool"); done
NEED_SUDO=0
[ "${#MISSING[@]}" -eq 0 ] || NEED_SUDO=1
command -v docker >/dev/null 2>&1 || NEED_SUDO=1
docker compose version >/dev/null 2>&1 || NEED_SUDO=1
id -nG "$USER" | tr ' ' '\n' | grep -qx docker || NEED_SUDO=1
if [ "$NEED_SUDO" -eq 1 ]; then
  say "Nexternel needs a few standard tools. Type this computer's password if it asks."
  sudo -v || die "The password was not accepted, so nothing was installed. Run the install line again."
fi

install_tools() {
  if [ "${#MISSING[@]}" -gt 0 ]; then
    sudo apt-get update -qq
    sudo apt-get install -y -qq "${MISSING[@]}"
  fi
  if ! command -v docker >/dev/null 2>&1; then
    curl -fsSL https://get.docker.com | sudo sh
    sudo systemctl enable --now docker || true
  fi
  if ! docker compose version >/dev/null 2>&1; then
    sudo apt-get install -y -qq docker-compose-plugin
  fi
  if ! id -nG "$USER" | tr ' ' '\n' | grep -qx docker; then
    sudo usermod -aG docker "$USER"
  fi
}
step "Getting the tools Nexternel runs on" "The tools could not be installed. Check this machine's internet connection, then run the install line again." install_tools

# Run a command with Docker access — `sg` covers a group membership added in this session.
as_docker() {
  if docker info >/dev/null 2>&1; then bash -c "$1"; else sg docker -c "$1"; fi
}

# --- 3. Nexternel's files ---------------------------------------------------------------
get_files() {
  if [ -d "$SOURCE" ]; then
    cp -a "$SOURCE"/. "$DIR"/
  elif [ -f "$SOURCE" ]; then
    tar -xzf "$SOURCE" -C "$DIR" --strip-components=1
  else
    curl -fsSL "$SOURCE" | tar -xz -C "$DIR" --strip-components=1
  fi
  [ -f "$DIR/docker-compose.yml" ]
}
step "Downloading Nexternel" "Nexternel could not be downloaded. Check this machine's internet connection, then run the install line again." get_files

# --- 4. Passwords, settings, and start ---------------------------------------------------
cd "$DIR"
step "Starting Nexternel (the first start takes a few minutes)" "Nexternel did not start." as_docker "bash scripts/setup-server.sh"

# --- 5. Wait until it answers ------------------------------------------------------------
read_env() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '\r"'; }
SERVER_IP=$(read_env SERVER_IP)
UI_PORT=$(read_env UI_PORT)
API_PORT=$(read_env API_PORT)
wait_answer() {
  for _ in $(seq 1 120); do
    curl -sf -m 3 "http://127.0.0.1:${API_PORT:-4000}/api/v1/setup/status" >/dev/null && return 0
    sleep 3
  done
  return 1
}
step "Waiting for Nexternel to answer" "Nexternel did not answer within 6 minutes. Restart this machine, wait 5 minutes, then open http://nexternel.local in a browser. Keep the details file: it shows what went wrong." wait_answer

ADDR1="http://nexternel.local"
ADDR2="http://${SERVER_IP:-this-machine}"
WIDTH=$(( ${#ADDR2} > ${#ADDR1} ? ${#ADDR2} : ${#ADDR1} ))
line=$(printf '%*s' $((WIDTH + 4)) '' | tr ' ' '-')
echo
printf '  \033[1mNexternel is running. Open it in a browser on any device at home:\033[0m\n\n'
printf '    +%s+\n' "$line"
printf '    |  \033[1m%-*s\033[0m  |\n' "$WIDTH" "$ADDR1"
printf '    +%s+\n' "$line"
printf '    If that one does not open, use this one instead:\n'
printf '    +%s+\n' "$line"
printf '    |  \033[1m%-*s\033[0m  |\n' "$WIDTH" "$ADDR2"
printf '    +%s+\n\n' "$line"
printf '  Write these down or save them as a bookmark: they are how you reach Nexternel.\n'
printf '  The setup on screen takes you through the rest.\n\n'
printf '  Tip: in your router, reserve the address %s for this machine,\n' "${SERVER_IP:-of this machine}"
printf '  so it never changes; your devices find Nexternel by it.\n\n'
