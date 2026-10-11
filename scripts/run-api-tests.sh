#!/bin/bash
# Run API backup/restore tests inside Docker (matches production build environment).
set -e
cd "$(dirname "$0")/.."
docker compose build api
docker build -f apps/api/Dockerfile --target builder -t nexternel-api-test .
docker run --rm nexternel-api-test sh -c "cd /app/apps/api && npm test"
