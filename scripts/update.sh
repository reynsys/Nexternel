#!/usr/bin/env bash
# =============================================================================
# Update Nexternel to the latest release:
#
#   cd ~/nexternel && ./scripts/update.sh
#
# - keeps your settings (.env), backups, device files and camera list untouched
# - saves a safety copy of your settings in backups/ first
# - removes files the new version no longer uses
# - rebuilds and restarts; if that fails, puts the previous version back
#
# Options: NEXTERNEL_SOURCE (a release .tar.gz URL or file), FORCE=1 (reinstall the same version)
# Your home data lives in the databases; Nexternel's automatic backups protect it.
# =============================================================================
set -euo pipefail
# Plain byte order for sort and comm, whatever the machine's language settings.
export LC_ALL=C

RELEASE_URL="https://github.com/reynsys/nexternel/releases/latest/download/nexternel.tar.gz"
SOURCE="${NEXTERNEL_SOURCE:-$RELEASE_URL}"

say() { printf '\033[1;32m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m X\033[0m  %s\n' "$*" >&2; exit 1; }

cd "$(dirname "$0")/.."
DIR="$PWD"
[ -f docker-compose.yml ] && [ -f .env ] || die "Run this inside your Nexternel folder (it has docker-compose.yml and .env)."

as_docker() {
  if docker info >/dev/null 2>&1; then bash -c "$1"; else sg docker -c "$1"; fi
}

CURRENT="$(cat VERSION 2>/dev/null || echo "an older version")"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/new"

say "Getting the latest Nexternel…"
if [ -f "$SOURCE" ]; then
  tar -xzf "$SOURCE" -C "$TMP/new" --strip-components=1
else
  curl -fsSL "$SOURCE" | tar -xz -C "$TMP/new" --strip-components=1
fi
[ -f "$TMP/new/VERSION" ] && [ -f "$TMP/new/.release-files" ] || die "The download is not a Nexternel release."
NEW="$(cat "$TMP/new/VERSION")"

if [ "$NEW" = "$CURRENT" ] && [ "${FORCE:-}" != "1" ]; then
  say "Nexternel $CURRENT is already the latest version."
  exit 0
fi
say "Updating $CURRENT → $NEW"

# Files the user (or Nexternel at run time) owns: never replaced by a release.
KEEP_IF_PRESENT=(go2rtc/go2rtc.yaml mosquitto/config/mosquitto.conf)
for f in "${KEEP_IF_PRESENT[@]}"; do
  [ -f "$f" ] && rm -f "$TMP/new/$f"
done

# 1. Safety copy of settings (some files are written by Nexternel's services, so read them via Docker).
STAMP="$(date +%Y-%m-%d-%H%M)"
mkdir -p backups
as_docker "docker run --rm -v '$DIR':/n alpine tar -czf /n/backups/pre-update-$STAMP.tar.gz -C /n .env mosquitto/config esphome go2rtc" \
  && say "Settings saved in backups/pre-update-$STAMP.tar.gz"

# Nexternel's code folders belong to the release (never your data). Build output is left alone,
# and so are private skin packs.
CODE_DIRS=(apps packages db)
list_code_files() {
  find "${CODE_DIRS[@]}" -type f -not -path "*/node_modules/*" -not -path "*/dist/*" \
    -not -path "apps/ui/src/skins/local/*" 2>/dev/null | sort -u
}

# 2. Copy of the current release files, to put back if the update fails.
if [ -f .release-files ]; then
  CURRENT_FILES="$(cat .release-files)"
else
  # First update of an installation made from copied files (e.g. FileZilla): it has no file list yet,
  # so take everything in the code folders plus the release's top-level files.
  CURRENT_FILES="$(list_code_files; ls -1 docker-compose.yml install.sh package.json package-lock.json 2>/dev/null)"
fi
printf '%s\n' "$CURRENT_FILES" > "$TMP/current-files"
tar -czf "$TMP/previous.tar.gz" --ignore-failed-read -T "$TMP/current-files" 2>/dev/null || true

# 3. Remove files the new release no longer has, then copy the new release in.
if [ -f .release-files ]; then
  OBSOLETE="$(comm -23 <(sort -u .release-files) <(sort -u "$TMP/new/.release-files"))"
else
  # Copied files leave old ones behind (copying never deletes): remove code files the release lacks.
  OBSOLETE="$(comm -23 <(list_code_files) <(sort -u "$TMP/new/.release-files"))"
fi
printf '%s\n' "$OBSOLETE" | while IFS= read -r f; do
  [ -n "$f" ] && [ -f "$f" ] && rm -f -- "$f"
done
tar -C "$TMP/new" -cf - . | tar -C "$DIR" -xf -

# 4. Rebuild and restart; on failure, go back.
say "Rebuilding and restarting (this takes a few minutes)…"
if as_docker "docker compose build api ui && docker compose up -d --remove-orphans"; then
  API_PORT="$(grep -E '^API_PORT=' .env | tail -1 | cut -d= -f2 | tr -d '\r"' || true)"
  for _ in $(seq 1 60); do
    if curl -sf -m 3 "http://127.0.0.1:${API_PORT:-4000}/api/v1/health" >/dev/null 2>&1; then
      say "Nexternel $NEW is running."
      as_docker "docker image prune -f" >/dev/null 2>&1 || true
      exit 0
    fi
    sleep 3
  done
  die "Nexternel $NEW started but does not answer yet. Check: docker compose ps"
fi

if [ -f "$TMP/previous.tar.gz" ]; then
  say "The update failed — putting $CURRENT back…"
  comm -23 <(sort -u "$TMP/new/.release-files") <(tar -tzf "$TMP/previous.tar.gz" | sort -u) | while IFS= read -r f; do
    [ -n "$f" ] && [ -f "$f" ] && rm -f -- "$f"
  done
  tar -xzf "$TMP/previous.tar.gz" -C "$DIR"
  as_docker "docker compose build api ui && docker compose up -d --remove-orphans" && die "Update to $NEW failed; $CURRENT is running again."
fi
die "Update to $NEW failed. Your settings copy is in backups/pre-update-$STAMP.tar.gz."
