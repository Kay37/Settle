#!/usr/bin/env bash
set -euo pipefail
cat .cursor-tmp/App.tsx.gz.b64.0 \
    .cursor-tmp/App.tsx.gz.b64.1 \
    .cursor-tmp/App.tsx.gz.b64.2 \
    .cursor-tmp/App.tsx.gz.b64.3 \
    .cursor-tmp/App.tsx.gz.b64.4 \
  | tr -d '\n' \
  | base64 -d \
  | gzip -dc > src/App.tsx
sha256sum -c .cursor-tmp/App.tsx.sha256
