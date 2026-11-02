#!/bin/bash
set -e

MSG="${1:-Update wetube cine features}"

echo "🚀 Đang chuẩn bị đồng bộ mã nguồn..."
git add -A

if git diff --staged --quiet; then
  echo "ℹ️ Không có thay đổi mới cần commit."
else
  git commit -m "$MSG"
fi

echo "📦 Đang push lên GitHub..."
git push origin main

echo "⚡ Đang kích hoạt Render Deploy Hook..."
RES=$(curl -s -w "\n%{http_code}" -X POST "https://api.render.com/deploy/srv-dbk5cvuc6qcc73dj5d60?key=76ETnQ4n4zU")
HTTP_CODE=$(echo "$RES" | tail -n1)

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
  echo "✅ Render đã nhận lệnh deploy tự động thành công! (HTTP $HTTP_CODE)"
else
  echo "⚠️ Render phản hồi: $HTTP_CODE"
fi
