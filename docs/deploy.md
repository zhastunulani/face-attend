# Развёртывание FaceAttend на face-attent.zhastunulani.kz

- Сервер: `89.167.75.40` (тот же, что у LeadLink, ZhAlert и других), приложение слушает `127.0.0.1:4350`.
- База: **Neon** (локальный PostgreSQL сервера не используется). Строка подключения хранится только в `/etc/faceattend/env`.
- Приложение: `/opt/faceattend/app`, Linux-пользователь `faceattend` (вход только по ключу `~/.ssh/faceattend_deploy`, алиас `ssh faceattend`), сервис `faceattend-web`.

## 1. DNS (ps.kz)

Управление DNS → `zhastunulani.kz` → «Добавить запись»: тип **A**, имя домена **`face-attent`** (консоль сама допишет `.zhastunulani.kz`), IP `89.167.75.40`.

## 2. Первая установка (root)

Локально (Git Bash):

```bash
bash deploy/release.sh --setup          # нужен Neon CLI после `neon login`: строка подключения попадёт в .release/setup/neon.env
scp -r .release/setup root@89.167.75.40:/tmp/faceattend-setup
rm -rf .release/setup                   # локальная копия с паролем базы больше не нужна
```

На сервере:

```bash
bash /tmp/faceattend-setup/setup-server.sh   # DATABASE_URL берётся из neon.env (иначе спросит скрытым вводом)
rm -rf /tmp/faceattend-setup
```

Скрипт сам генерирует `JWT_SECRET`, выпускает сертификат Let's Encrypt и разрешает пользователю `faceattend` только `systemctl restart faceattend-web`.

## 3. После установки

1. Войти на https://face-attent.zhastunulani.kz. Если в базе остался стандартный пароль (`admin123` и т. п.), система попросит его сменить.
2. На планшете-киоске войти как admin, открыть `/scan` и нажать «Киоск ету». Без этого отметки не принимаются.

## Обновления

```bash
bash deploy/release.sh
```

Две предыдущие версии остаются в `/opt/faceattend/app.previous-*` для отката.
