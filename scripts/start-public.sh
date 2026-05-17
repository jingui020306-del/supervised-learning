#!/bin/bash
# Trackly · Public Tunnel Launcher
# Starts server + creates public URL via Serveo
# Friend's iPad accesses: https://trackly-jin.serveo.net/dashboard?userId=xxx

DIR="$(cd "$(dirname "$0")/.." && pwd)"
echo "🌳 Trackly · 公网模式"
echo ""

# Start server
cd "$DIR/release"
pkill -f supervised-learning-macos 2>/dev/null || true
sleep 1
./supervised-learning-macos &
sleep 3

# Check server
if ! curl -s http://localhost:3001/health > /dev/null 2>&1; then
  echo "❌ 服务器启动失败"
  exit 1
fi
echo "✅ 服务端已启动 (localhost:3001)"

# Create tunnel
echo "🔗 正在创建公网隧道..."
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=60 \
    -o ExitOnForwardFailure=yes \
    -R trackly-jin:80:localhost:3001 serveo.net 2>&1 &

sleep 3

echo ""
echo "══════════════════════════════════════"
echo "  📱 朋友用 iPad/iPhone 打开："
echo ""
echo "  https://trackly-jin.serveo.net/dashboard"
echo ""
echo "  加 ?userId=名字 来区分不同人"
echo "══════════════════════════════════════"
echo ""
echo "按 Ctrl+C 停止"

# Keep running
wait
