#!/usr/bin/env bash
# Installs or updates the proxy as a systemd user service on the VPS (no sudo needed;
# `loginctl enable-linger` must already be on) and mounts it on the Tailscale Funnel
# at https://<node>.ts.net/tvscores/. Re-run after every proxy change.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p ~/.config/systemd/user
cp deploy/tvscores-proxy.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now tvscores-proxy.service
systemctl --user restart tvscores-proxy.service
tailscale funnel --bg --set-path /tvscores http://127.0.0.1:8787 >/dev/null
sleep 2
systemctl --user --no-pager status tvscores-proxy.service | head -3
curl -s "http://127.0.0.1:8787/v1/health" | head -c 300; echo
