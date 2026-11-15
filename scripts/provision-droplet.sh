#!/usr/bin/env bash
# One-time droplet provisioning for the evonaire-web deploy target.
# Run as root on the droplet. Idempotent, safe to re-run.
#
#   ./provision-droplet.sh --domain evonaire.ai \
#       --deploy-pubkey-file /path/to/ci-deploy.pub
#
# Creates the evonaire-web service account that runs the unit and the
# deploy SSH account that receives CI deploys. It also creates the
# /opt/evonaire-web layout, writes the sudoers restart rule and systemd
# unit, then adds an nginx vhost proxying the frontend domain to
# 127.0.0.1:3000. TLS stays with certbot after DNS cutover. See
# docs/DROPLET-DEPLOY.md.
set -euo pipefail

DOMAIN=""
PUBKEY_FILE=""

usage() {
  sed -n '2,11p' "$0" >&2
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --domain) DOMAIN="$2"; shift 2 ;;
    --deploy-pubkey-file) PUBKEY_FILE="$2"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "unknown argument: $1" >&2; usage ;;
  esac
done

DOMAIN="${DOMAIN:-evonaire.ai}"

if [ "$(id -u)" -ne 0 ]; then
  echo "run as root" >&2
  exit 1
fi

if [[ ! "$DOMAIN" =~ ^[a-z0-9.-]+$ ]]; then
  echo "invalid domain: $DOMAIN" >&2
  exit 1
fi

echo "== accounts =="

if ! getent group evonaire-web >/dev/null; then
  groupadd --system evonaire-web
fi

NOLOGIN=""
for cand in /usr/sbin/nologin /sbin/nologin /usr/bin/nologin /bin/nologin; do
  if [ -x "$cand" ]; then NOLOGIN="$cand"; break; fi
done
if [ -z "$NOLOGIN" ]; then
  echo "no nologin binary found" >&2
  exit 1
fi

if ! id evonaire-web >/dev/null 2>&1; then
  useradd --system --gid evonaire-web --shell "$NOLOGIN" \
    --home-dir /nonexistent --no-create-home evonaire-web
fi

if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash --groups evonaire-web deploy
else
  usermod --append --groups evonaire-web deploy
fi

if [ -n "$PUBKEY_FILE" ]; then
  if [ ! -f "$PUBKEY_FILE" ]; then
    echo "pubkey file not found: $PUBKEY_FILE" >&2
    exit 1
  fi
  KEY_BLOB="$(awk '{print $1" "$2}' "$PUBKEY_FILE")"
  install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
  AUTH_KEYS=/home/deploy/.ssh/authorized_keys
  touch "$AUTH_KEYS"
  chown deploy:deploy "$AUTH_KEYS"
  chmod 600 "$AUTH_KEYS"
  if ! grep -qF "$KEY_BLOB" "$AUTH_KEYS"; then
    printf 'restrict %s\n' "$(cat "$PUBKEY_FILE")" >> "$AUTH_KEYS"
  fi
  echo "installed deploy pubkey in $AUTH_KEYS"
else
  echo "no --deploy-pubkey-file given; /home/deploy/.ssh/authorized_keys untouched"
fi

echo "== /opt/evonaire-web layout =="

install -d -o root -g evonaire-web -m 2775 /opt/evonaire-web
install -d -o root -g evonaire-web -m 2775 /opt/evonaire-web/releases
install -d -o root -g evonaire-web -m 2775 /opt/evonaire-web/incoming

echo "== sudoers =="

SYSTEMCTL="$(command -v systemctl)"
if [ "$SYSTEMCTL" != "/usr/bin/systemctl" ]; then
  echo "warning - systemctl resolves to $SYSTEMCTL, the deploy script calls /usr/bin/systemctl" >&2
fi

SUDOERS_TMP="$(mktemp)"
cat > "$SUDOERS_TMP" <<EOF
deploy ALL=(root) NOPASSWD: $SYSTEMCTL restart evonaire-web
EOF
if ! visudo -cf "$SUDOERS_TMP" >/dev/null; then
  rm -f "$SUDOERS_TMP"
  echo "generated sudoers rule failed validation" >&2
  exit 1
fi
install -o root -g root -m 0440 "$SUDOERS_TMP" /etc/sudoers.d/evonaire-web-deploy
rm -f "$SUDOERS_TMP"
echo "wrote /etc/sudoers.d/evonaire-web-deploy"

echo "== systemd unit =="

cat > /etc/systemd/system/evonaire-web.service <<'UNIT'
[Unit]
Description=EVONAIRE Next.js frontend
After=network.target

[Service]
Type=simple
User=evonaire-web
WorkingDirectory=/opt/evonaire-web/current
Environment=NODE_ENV=production
Environment=PORT=3000
# <!-- deslop-disable-next-line -->
ExecStart=/usr/bin/npm run start -- -H 127.0.0.1
Restart=on-failure
RestartSec=5
UMask=0002
# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/evonaire-web
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable evonaire-web
echo "installed and enabled evonaire-web.service (left stopped until first deploy)"

echo "== node runtime check =="

if [ ! -x /usr/bin/npm ]; then
  echo "warning: /usr/bin/npm not found; ExecStart expects Node 22 via NodeSource" >&2
elif ! /usr/bin/node --version 2>/dev/null | grep -q '^v22\.'; then
  echo "warning: node is $(/usr/bin/node --version 2>/dev/null || echo missing), expected v22.x" >&2
fi

echo "== nginx vhost =="

if ! command -v nginx >/dev/null; then
  echo "nginx not installed; skipping vhost" >&2
else
  cat > /etc/nginx/conf.d/evonaire-web.conf <<EOF
# EVONAIRE Next.js frontend. TLS via certbot after DNS cutover.
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
  if nginx -t; then
    if systemctl is-active --quiet nginx; then
      systemctl reload nginx
    else
      echo "nginx is not active; start it to pick up the vhost" >&2
    fi
    echo "wrote /etc/nginx/conf.d/evonaire-web.conf"
  else
    echo "nginx -t failed; fix /etc/nginx/conf.d/evonaire-web.conf and reload" >&2
    exit 1
  fi
fi

cat <<EOF

Done. Manual steps remain.

1. If no pubkey was installed, add the CI deploy public key to
   /home/deploy/.ssh/authorized_keys with the restrict option.
2. After DNS points at this droplet, run certbot --nginx for
   $DOMAIN and www.$DOMAIN.
3. Set the DROPLET_* secrets and NEXT_PUBLIC_* variables in the repo
   settings per docs/DROPLET-DEPLOY.md.
4. First deploy: push to main or run the Deploy workflow. The deploy
   script creates current and restarts the unit.
EOF
