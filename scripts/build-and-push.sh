#!/usr/bin/env bash
# Build all four custom images and push them to Docker Hub.
# Run from the repo root on a machine with `docker login` (or `podman login`) done.
#
# Usage:
#   scripts/build-and-push.sh            # builds + pushes :latest
#   scripts/build-and-push.sh v2026-04   # also tags + pushes v2026-04
#
# The server pulls whatever :latest points at, so the optional version tag is
# just a rollback anchor.

set -euo pipefail

REGISTRY="docker.io/davidedge"
VERSION_TAG="${1:-}"

# Use docker if present (Docker Desktop on Windows), otherwise podman.
if command -v docker >/dev/null 2>&1; then
  ENGINE=docker
else
  ENGINE=podman
fi
echo "Using $ENGINE for build/push"

build_push() {
  local name="$1"
  local context="$2"
  local dockerfile="$3"
  local image="$REGISTRY/$name:latest"
  echo ""
  echo "=== $name ==="
  $ENGINE build -t "$image" -f "$dockerfile" "$context"
  $ENGINE push "$image"
  if [[ -n "$VERSION_TAG" ]]; then
    local versioned="$REGISTRY/$name:$VERSION_TAG"
    $ENGINE tag "$image" "$versioned"
    $ENGINE push "$versioned"
  fi
}

build_push presto-orchestrator   .                         Dockerfile.orchestrator
build_push presto-nginx          nginx                     nginx/Dockerfile.prod
build_push presto-tile-server    tileserver                tileserver/Dockerfile
build_push presto-proxy-analysis getLipds/proxyAnalysis    getLipds/proxyAnalysis/Dockerfile

echo ""
echo "All images pushed. On the server:"
echo "  cd /srv/presto && podman-compose -f docker-compose.prod.yml pull && podman-compose -f docker-compose.prod.yml up -d"
