#!/usr/bin/env bash
# Первичная установка FaceAttend на face-attent.zhastunulani.kz. Выполняется ОДИН РАЗ от root:
#   bash /tmp/faceattend-setup/setup-server.sh
# Рядом со скриптом: faceattend-release.tar.gz, faceattend-web.service, nginx.conf, faceattend_deploy.pub
# и (необязательно) neon.env со строкой подключения Neon — иначе скрипт спросит её скрытым вводом.
# До запуска: A-запись face-attent.zhastunulani.kz → IP сервера (иначе certbot не выпустит сертификат).
#
# База данных — Neon (не локальный PostgreSQL). Строка подключения вводится скрытым вводом
# и записывается только в /etc/faceattend/env (root:faceattend, 640).
#
# Повторный запуск безопасен: env, ключи и сертификат не перезаписываются.
set -euo pipefail

DOMAIN=face-attent.zhastunulani.kz
PORT=4350
SRC=$(cd "$(dirname "$0")" && pwd)
APP=/opt/faceattend/app
ENV_FILE=/etc/faceattend/env

[[ $EUID -eq 0 ]] || { echo "Запустите от root: bash $0" >&2; exit 1; }
for f in faceattend-release.tar.gz faceattend-web.service nginx.conf faceattend_deploy.pub; do
  [[ -f "$SRC/$f" ]] || { echo "Не найден $SRC/$f" >&2; exit 1; }
done
if ss -ltn | awk '{print $4}' | grep -q ":$PORT\$" && ! systemctl is-active --quiet faceattend-web; then
  echo "Порт $PORT занят другим процессом" >&2; exit 1
fi
NODE_MAJOR=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
[[ $NODE_MAJOR -ge 20 ]] || { echo "Нужен Node.js >= 20 (сейчас: $(node -v 2>/dev/null || echo нет))" >&2; exit 1; }

echo "==> Пользователь faceattend"
id faceattend >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/faceattend --shell /bin/bash faceattend
passwd -l faceattend >/dev/null 2>&1 || true
install -d -m 700 -o faceattend -g faceattend /home/faceattend/.ssh
touch /home/faceattend/.ssh/authorized_keys
PUBKEY=$(tr -d '\r' < "$SRC/faceattend_deploy.pub")
grep -qxF "$PUBKEY" /home/faceattend/.ssh/authorized_keys || echo "$PUBKEY" >> /home/faceattend/.ssh/authorized_keys
chown faceattend:faceattend /home/faceattend/.ssh/authorized_keys
chmod 600 /home/faceattend/.ssh/authorized_keys
usermod -aG systemd-journal faceattend

echo "==> $ENV_FILE"
install -d -m 750 -o root -g faceattend /etc/faceattend
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$SRC/neon.env" ]]; then
    # Подготовлено локально командой `bash deploy/release.sh --setup` через Neon CLI
    DB_URL=$(sed -n 's/^DATABASE_URL=//p' "$SRC/neon.env" | tr -d '\r')
    echo "Строка подключения Neon взята из neon.env"
  else
    echo "Вставьте строку подключения Neon (Dashboard → Connect, вида postgresql://...neon.tech/...?sslmode=require)."
    echo "Ввод скрыт и нигде не выводится."
    read -rsp "DATABASE_URL: " DB_URL; echo
  fi
  [[ "$DB_URL" == postgres* ]] || { echo "Строка должна начинаться с postgres" >&2; exit 1; }
  umask 027
  {
    echo "DATABASE_URL=$DB_URL"
    echo "JWT_SECRET=$(openssl rand -hex 32)"
    echo "APP_TIMEZONE=Asia/Almaty"
    echo "# Пароль первого admin — используется только если база пустая"
    echo "ADMIN_PASSWORD=$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"
  } > "$ENV_FILE"
  umask 022
  unset DB_URL
fi
chown root:faceattend "$ENV_FILE"
chmod 640 "$ENV_FILE"

echo "==> Приложение $APP"
install -d -m 755 -o faceattend -g faceattend /opt/faceattend
if [[ -d "$APP/.output" ]]; then
  mv "$APP" "/opt/faceattend/app.previous-$(date +%Y%m%d%H%M%S)"
fi
install -d -m 755 -o faceattend -g faceattend "$APP"
tar -xzf "$SRC/faceattend-release.tar.gz" -C "$APP"
chown -R faceattend:faceattend "$APP"

echo "==> Сервис faceattend-web"
install -m 644 "$SRC/faceattend-web.service" /etc/systemd/system/faceattend-web.service
systemctl daemon-reload
systemctl enable --now faceattend-web
systemctl restart faceattend-web

echo "==> nginx $DOMAIN"
[[ -f /etc/nginx/sites-available/faceattend ]] || install -m 644 "$SRC/nginx.conf" /etc/nginx/sites-available/faceattend
ln -sf /etc/nginx/sites-available/faceattend /etc/nginx/sites-enabled/faceattend
nginx -t
systemctl reload nginx
if ! grep -q "ssl_certificate" /etc/nginx/sites-available/faceattend; then
  certbot --nginx -d "$DOMAIN" --non-interactive --redirect --keep-until-expiring
fi
nginx -t
systemctl reload nginx

echo "==> Права на обновления для faceattend"
SYSTEMCTL=$(command -v systemctl)
cat > /etc/sudoers.d/faceattend <<EOF
# Права развёртывания FaceAttend (создано setup-server.sh)
faceattend ALL=(root) NOPASSWD: $SYSTEMCTL restart faceattend-web
EOF
chmod 440 /etc/sudoers.d/faceattend
visudo -cf /etc/sudoers.d/faceattend

echo "==> Проверка"
sleep 5
systemctl --no-pager --lines=0 status faceattend-web | grep -E "Active:|●"
curl -s -o /dev/null -w "http://127.0.0.1:$PORT/api/kiosk/status -> %{http_code}\n" "http://127.0.0.1:$PORT/api/kiosk/status" || true
curl -s -o /dev/null -w "https://$DOMAIN/login -> %{http_code}\n" "https://$DOMAIN/login" || true
journalctl -u faceattend-web --no-pager -n 20 | grep -E "Database initialized|initialization error|one-time password|default password" || true
echo
shred -u "$SRC/neon.env" 2>/dev/null || rm -f "$SRC/neon.env"
echo "Готово: https://$DOMAIN"
echo "Если база была пустой — пароль admin: grep ADMIN_PASSWORD $ENV_FILE (только root)."
