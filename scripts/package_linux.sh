#!/usr/bin/env bash
set -euo pipefail

APP_NAME="kxyz-backend"
VERSION="${1:-$(date +%Y%m%d%H%M%S)}"
OUT_DIR="dist/${APP_NAME}-${VERSION}-linux-amd64"

mkdir -p "${OUT_DIR}"

CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o "${OUT_DIR}/${APP_NAME}" ./cmd/server
cp AGENTS.md PRD.md OpenAPI.json "${OUT_DIR}/"

tar -czf "${OUT_DIR}.tar.gz" -C "dist" "${APP_NAME}-${VERSION}-linux-amd64"

echo "Package generated: ${OUT_DIR}.tar.gz"
