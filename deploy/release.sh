#!/usr/bin/env bash
# Обновление FaceAttend на сервере с локального компьютера (Git Bash):
#   bash deploy/release.sh
# Сборка локально, на сервер уходит только .output. Нужен SSH: Host faceattend → faceattend@89.167.75.40.
#
# Первая установка — deploy/setup-server.sh от root (см. docs/deploy.md):
#   bash deploy/release.sh --setup     # собрать .release/setup/ для копирования на сервер
set -euo pipefail

HOST=${FACEATTEND_HOST:-faceattend}
ROOT=$(cd "$(dirname "$0")/.." && pwd)
STAMP=$(date +%Y%m%d%H%M%S)
cd "$ROOT"

echo "==> Проверка типов и сборка"
npx nuxi typecheck
npx nuxi build

echo "==> Пакет"
rm -rf .release && mkdir -p .release/stage
cp -r .output .release/stage/
cp package.json .release/stage/
tar -czf ".release/faceattend-$STAMP.tar.gz" -C .release/stage .

if [[ "${1:-}" == "--setup" ]]; then
  mkdir -p .release/setup
  cp ".release/faceattend-$STAMP.tar.gz" .release/setup/faceattend-release.tar.gz
  cp deploy/faceattend-web.service deploy/nginx.conf deploy/setup-server.sh .release/setup/
  cp ~/.ssh/faceattend_deploy.pub .release/setup/
  # Строка подключения к ветке production в Neon (через Neon CLI, `neon login`). Не выводится и не коммитится.
  if command -v neon >/dev/null 2>&1; then
    ( umask 077; echo "DATABASE_URL=$(neon connection-string production --project-id "${NEON_PROJECT_ID:-little-lab-29526625}" --database-name neondb --pooled)" > .release/setup/neon.env )
    echo "neon.env: строка подключения Neon добавлена в пакет"
  else
    echo "Neon CLI не найден — setup-server.sh спросит DATABASE_URL"
  fi
  # Сервер — Linux: никаких CRLF в скриптах, конфигах и строке подключения
  for f in .release/setup/*.sh .release/setup/*.service .release/setup/*.conf .release/setup/*.pub .release/setup/neon.env; do
    [[ -f "$f" ]] || continue
    tr -d '\r' < "$f" > "$f.tmp" && mv "$f.tmp" "$f"
  done
  if grep -q "$(printf '\r')" .release/setup/*.sh .release/setup/*.service .release/setup/*.conf; then
    echo "CRLF left in setup package" >&2; exit 1
  fi
  echo "Готово: .release/setup/ (скопировать на сервер: scp -r .release/setup root@89.167.75.40:/tmp/faceattend-setup)"
  echo "ВНИМАНИЕ: .release/setup/neon.env содержит пароль базы — после установки удалите .release/setup"
  exit 0
fi

echo "==> Загрузка и переключение"
scp -q ".release/faceattend-$STAMP.tar.gz" "$HOST:/opt/faceattend/"
ssh "$HOST" bash -s "$STAMP" <<'REMOTE'
set -euo pipefail
STAMP=$1
cd /opt/faceattend
mkdir "release-$STAMP"
tar -xzf "faceattend-$STAMP.tar.gz" -C "release-$STAMP"
mv app "app.previous-$STAMP"
mv "release-$STAMP" app
rm -f "faceattend-$STAMP.tar.gz"
sudo systemctl restart faceattend-web
sleep 5
systemctl is-active faceattend-web
curl -s -o /dev/null -w "login %{http_code}\n" http://127.0.0.1:4350/login
ls -1d app.previous-* 2>/dev/null | sort | head -n -2 | xargs -r rm -rf
REMOTE
echo "Готово: https://face-attent.zhastunulani.kz"
