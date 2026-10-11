#!/bin/bash
# Load .env into the current shell (strips CRLF from .env).
# Package version: see VERSION at repo root.
#
# Run from project root:
#   source scripts/load-env.sh

if [ ! -f .env ]; then
  echo "Error: .env not found. Copy .env.example to .env in the project root." >&2
  return 1 2>/dev/null || exit 1
fi

set -a
# shellcheck disable=SC1090
source <(sed 's/\r$//' .env)
set +a
