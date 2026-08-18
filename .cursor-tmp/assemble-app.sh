#!/usr/bin/env bash
set -euo pipefail
patch -p1 < .cursor-tmp/App.tsx.patch
sha256sum -c .cursor-tmp/App.tsx.sha256
