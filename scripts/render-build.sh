#!/bin/bash
# Trackly · Render.com deployment script
# Free tier: web service (sleeps after 15min idle) + persistent disk

set -e

echo "=== Trackly Render Deploy ==="

# 1. Build TypeScript
cd backend
npm install
npx prisma generate
npx tsc -p tsconfig.release.json && cp -r src/views dist/

# 2. Ensure static assets are available
mkdir -p dist/views/partials
cp ../release/views/partials/* dist/views/partials/ 2>/dev/null || true

# 3. Copy Prisma schema for db push
cp -r prisma dist/

cd ..
echo "Build complete. dist/ is ready for Render deployment."
