#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
npm ci
npx netlify deploy --build --prod
