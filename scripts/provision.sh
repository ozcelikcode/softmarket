#!/usr/bin/env bash
set -euo pipefail
if [[ "$(id -u)" != 0 ]]; then echo 'Run as root on Ubuntu 24.04' >&2; exit 1; fi
apt-get update
apt-get install -y curl ca-certificates gnupg rsync sqlite3 ufw debian-keyring debian-archive-keyring apt-transport-https
install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_24.x nodistro main\n' > /etc/apt/sources.list.d/nodesource.list
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/caddy.gpg
printf 'deb [signed-by=/etc/apt/keyrings/caddy.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main\n' > /etc/apt/sources.list.d/caddy.list
apt-get update
apt-get install -y nodejs caddy
npm install -g corepack
corepack enable
corepack prepare pnpm@12.16.1 --activate
if ! command -v litestream >/dev/null; then
  arch="$(dpkg --print-architecture)"
  curl -fsSL "https://github.com/benbjohnson/litestream/releases/download/v0.3.13/litestream-v0.3.13-linux-${arch}.deb" -o /tmp/softmarket-litestream.deb
  apt-get install -y /tmp/softmarket-litestream.deb
fi
id softmarket >/dev/null 2>&1 || useradd --system --home-dir /opt/softmarket --shell /usr/sbin/nologin softmarket
install -d -o softmarket -g softmarket /opt/softmarket/releases /opt/softmarket/shared/data /opt/softmarket/shared/uploads /opt/softmarket/replica
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
echo 'Install deploy/*.service, Caddyfile and litestream.yml in /etc; create /etc/softmarket.env before starting services.'
