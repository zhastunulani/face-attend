# Production server

Installed 2026-11-08 by `deploy/setup-server.sh` (run once as root by the owner).

- URL: https://face-attent.zhastunulani.kz (Let's Encrypt, expires 2027-02-06, renewed by the existing certbot timer).
- Server: `89.167.75.40` (same host as LeadLink, ZhAlert, Sale-bot, ZhMail).
- Application: `/opt/faceattend/app`, Linux user `faceattend` (SSH key only: local `~/.ssh/faceattend_deploy`, alias `ssh faceattend`).
- Service: `faceattend-web` on `127.0.0.1:4350`; nginx site `/etc/nginx/sites-available/faceattend`.
- Database: **Neon**, project `faceattend` (`little-lab-29526625`), branch `production`, database `neondb`, pooled endpoint,
  region aws-us-east-1. Connection string only in `/etc/faceattend/env` (`root:faceattend`, 640) with `JWT_SECRET`, `APP_TIMEZONE`.
- Backup before the v2 schema changes: Neon branch `backup-before-v2-2026-11-08` (no compute, never expires).
- `faceattend` may run without password only: `systemctl restart faceattend-web`.

Updates: `bash deploy/release.sh` (local build, upload, switch; two previous versions kept as `/opt/faceattend/app.previous-*`).

Verification 2026-11-08: `/login`, `/scan`, `/api/kiosk/status`, face models → 200 over HTTPS; anonymous
`/api/employees?withFace=true` → 401; security headers present. On first start the schema was migrated on the real
data (7 employees, 17 attendance rows); `head` and `manager` still had default passwords and must change them on login.

Known: plain `http://` answers 403 from outside for all zhastunulani.kz sites (not from this app); HTTPS works.
Existing employee photos point to old `/uploads/...` paths and must be re-uploaded; employees 4 and 7 (and 1, 5) have
very similar face descriptors and should be re-registered.
