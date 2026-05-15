#!/bin/bash
# ═══════════════════════════════════════
# Trackly · Release Builder
# Builds standalone executable for current platform
# ═══════════════════════════════════════

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
RELEASE_DIR="$ROOT_DIR/release"

echo "=== Trackly Release Builder ==="
echo ""

# Clean
rm -rf "$RELEASE_DIR"
mkdir -p "$RELEASE_DIR"

# Install deps
cd "$BACKEND_DIR"
echo "[1/5] Installing dependencies..."
npm install

# Generate Prisma
echo "[2/5] Generating Prisma client..."
npx prisma generate

# Patch: pkg doesn't support Node.js package imports (#main-entry-point)
DEFAULT_JS="node_modules/.prisma/client/default.js"
if [ -f "$DEFAULT_JS" ]; then
  if [ "$(uname -s)" = "Darwin" ]; then
    sed -i '' "s/require('#main-entry-point')/require('.\/index.js')/" "$DEFAULT_JS"
  else
    sed -i "s/require('#main-entry-point')/require('.\/index.js')/" "$DEFAULT_JS"
  fi
  echo "  → Patched $DEFAULT_JS for pkg compatibility"
fi

# Build TypeScript (CJS for pkg compatibility)
echo "[3/5] Building TypeScript (CJS)..."
npx tsc -p tsconfig.release.json && cp -r src/views dist/

# Initialize database with schema
echo "  → Initializing database..."
npx prisma db push --skip-generate --accept-data-loss 2>/dev/null || true

# Package with @yao-pkg/pkg (maintained fork)
echo "[4/5] Packaging standalone executable..."

PKG="npx @yao-pkg/pkg"
FLAGS="--fallback-to-source"

# Detect current platform
OS=$(uname -s)
ARCH=$(uname -m)

case "$OS" in
  Darwin)
    case "$ARCH" in
      arm64) TARGET="node22-macos-arm64"; EXE_NAME="supervised-learning-macos" ;;
      x86_64) TARGET="node22-macos-x64"; EXE_NAME="supervised-learning-macos" ;;
    esac
    ;;
  Linux)
    TARGET="node22-linux-x64"; EXE_NAME="supervised-learning-linux"
    ;;
  MINGW*|MSYS*|CYGWIN*)
    TARGET="node22-win-x64"; EXE_NAME="supervised-learning-win.exe"
    ;;
  *)
    echo "Unknown OS: $OS, defaulting to node22-linux-x64"
    TARGET="node22-linux-x64"; EXE_NAME="supervised-learning-linux"
    ;;
esac

echo "  → Building for $TARGET..."
$PKG dist/index.js \
  --targets "$TARGET" \
  --output "$RELEASE_DIR/$EXE_NAME" \
  $FLAGS

echo "  → $(ls -lh "$RELEASE_DIR/$EXE_NAME" | awk '{print $5}') $(file "$RELEASE_DIR/$EXE_NAME" | cut -d: -f2-)"

# Copy static assets
echo "[5/5] Copying assets..."
mkdir -p "$RELEASE_DIR/data"
cp "$BACKEND_DIR/prisma/data/supervised-learning.db" "$RELEASE_DIR/data/trackly.db" 2>/dev/null || true
cp -r "$BACKEND_DIR/dist/views" "$RELEASE_DIR/views"
cp "$ROOT_DIR/.env.example" "$RELEASE_DIR/.env.example"
cp "$ROOT_DIR/docker-compose.yml" "$RELEASE_DIR/docker-compose.yml"
cp "$ROOT_DIR/LICENSE" "$RELEASE_DIR/LICENSE"
cp "$ROOT_DIR/README.md" "$RELEASE_DIR/README.md"

# Copy Prisma schema
mkdir -p "$RELEASE_DIR/prisma"
cp "$BACKEND_DIR/prisma/schema.prisma" "$RELEASE_DIR/prisma/"

# Create quickstart README
cat > "$RELEASE_DIR/README.txt" << 'RELEASE_EOF'
Trackly · 学习监督系统
======================

⚠️ 仅供个人/家庭使用，严禁商业行为

快速启动（手把手）:
  1. 把整个文件夹放到你想放的目录
  2. .env.example 改名为 .env（可选，不改也能用）
  3. 双击运行对应平台的执行文件
  4. 浏览器打开 http://localhost:3001/dashboard?userId=student-1

各平台构建方式:
  在当前平台运行 bash scripts/release.sh 即可生成当前平台的执行文件。
  其他平台请在对应系统上运行，或使用源码启动 / Docker。

或用 Docker（所有平台通用）:
  docker compose up -d

── 通知配置 ──

微信通知（免费，不需要服务器）:
  1. 打开 sct.ftqq.com → 微信扫码 → 复制 SendKey
  2. 填入 .env 的 SERVERCHAN_SEND_KEY
  3. 或在仪表盘「推送设置」页面直接填

飞书通知（免费，不需要服务器）:
  1. 飞书群 → 群设置 → 群机器人 → 添加自定义机器人
  2. 复制 Webhook 地址
  3. 填入 .env 的 FEISHU_WEBHOOK_URL

iPad 快捷指令配置: 见 README.md

禁止商用. 详情见 LICENSE.
RELEASE_EOF

# Create self-contained launcher (double-click to start)
cat > "$RELEASE_DIR/🌳启动.command" << 'LAUNCHER'
#!/bin/bash
DIR="$(cd "$(dirname "$0")" && pwd)"
nohup "$DIR/supervised-learning-macos" > /dev/null 2>&1 &
osascript -e 'tell app "Terminal" to close first window' &>/dev/null &
exit 0
LAUNCHER
chmod +x "$RELEASE_DIR/🌳启动.command"

# Summary
echo ""
echo "=== Done ==="
echo "Release files in: $RELEASE_DIR"
echo ""
ls -lh "$RELEASE_DIR/" 2>/dev/null
echo ""
echo "To deploy: 把 release 文件夹拷贝到目标电脑，双击运行 $EXE_NAME"
