#!/usr/bin/env bash
# Installs or updates the proxy as a systemd user service on the VPS (no sudo needed;
# `loginctl enable-linger` must already be on). Re-run after every proxy change. The
# public address, tvscores.julienmalige.com, is a Cloudflare Tunnel set up outside this
# repository; see ~/VPS.md. (The Tailscale Funnel mount it used to add was retired.)
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p ~/.config/systemd/user
cp deploy/tvscores-proxy.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now tvscores-proxy.service
systemctl --user restart tvscores-proxy.service
sleep 2
systemctl --user --no-pager status tvscores-proxy.service | head -3
curl -s "http://127.0.0.1:8787/v1/health" | head -c 300; echo
