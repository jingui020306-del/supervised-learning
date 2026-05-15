#!/bin/bash
# ═══════════════════════════════════════
# Supervised Learning · Release Builder
# Builds standalone executables for all platforms
# ═══════════════════════════════════════

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
RELEASE_DIR="$ROOT_DIR/release"

echo "=== Supervised Learning Release Builder ==="
echo ""

# Clean
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Install deps
cd "$BACKEND_DIR"
echo "[1/4] Installing dependencies..."
npm ci --omit=dev 2>/dev/null || npm install

# Generate Prisma
echo "[2/4] Generating Prisma client..."
npx prisma generate

# Build TypeScript
echo "[3/4] Building TypeScript..."
npm run build

# Package with pkg
echo "[4/4] Packaging standalone executables..."

# Check if pkg is available
if ! npx --no-install pkg --version &>/dev/null; then
  echo "  → Installing pkg globally..."
  npm install -g pkg
fi

echo "  → Building macOS executable..."
npx pkg dist/index.js \
  --targets node22-macos-x64,node22-macos-arm64 \
  --output "$RELEASE_DIR/supervised-learning-macos" \
  2>&1 | tail -1

echo "  → Building Windows executable..."
npx pkg dist/index.js \
  --targets node22-win-x64 \
  --output "$RELEASE_DIR/supervised-learning-win.exe" \
  2>&1 | tail -1

echo "  → Building Linux executable..."
npx pkg dist/index.js \
  --targets node22-linux-x64 \
  --output "$RELEASE_DIR/supervised-learning-linux" \
  2>&1 | tail -1

# Copy static assets
echo "  → Copying assets..."
cp -r "$BACKEND_DIR/dist/views" "$RELEASE_DIR/views"
cp "$ROOT_DIR/.env.example" "$RELEASE_DIR/.env.example"
cp "$ROOT_DIR/docker-compose.yml" "$RELEASE_DIR/docker-compose.yml"

# Copy Prisma schema and migrations
mkdir -p "$RELEASE_DIR/prisma"
cp "$BACKEND_DIR/prisma/schema.prisma" "$RELEASE_DIR/prisma/"

# Create README for release
cat > "$RELEASE_DIR/README.txt" << 'RELEASE_EOF'
Supervised Learning · 学习监督系统
=====================================

快速启动:
  1. 复制 .env.example 为 .env 并填入配置
  2. 运行对应平台的执行文件
  3. 浏览器打开 http://localhost:3001/dashboard

Windows: 双击 supervised-learning-win.exe
macOS:   ./supervised-learning-macos
Linux:   ./supervised-learning-linux

或使用 Docker:
  docker compose up -d

详情: https://github.com/jingui020306-del/supervised-learning
RELEASE_EOF

# Summary
echo ""
echo "=== Done ==="
echo "Release files in: $RELEASE_DIR"
ls -lh "$RELEASE_DIR"/*.exe "$RELEASE_DIR"/supervised-learning-* 2>/dev/null || true
echo ""
echo "To deploy:"
echo "  1. Copy the release folder to the target machine"
echo "  2. Set up .env with your configuration"
echo "  3. Run the executable"
