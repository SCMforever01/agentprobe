#!/usr/bin/env bash
# ponytail: iptables rules for transparent proxy — redirects outbound 443 to mitmproxy
set -euo pipefail

PROXY_PORT="${1:-9092}"
ACTION="${2:-start}"

case "$ACTION" in
  start)
    echo "Redirecting outbound :443 → localhost:$PROXY_PORT"
    sudo iptables -t nat -A OUTPUT -p tcp --dport 443 -m owner ! --uid-owner root -j REDIRECT --to-port "$PROXY_PORT"
    sudo ip6tables -t nat -A OUTPUT -p tcp --dport 443 -m owner ! --uid-owner root -j REDIRECT --to-port "$PROXY_PORT"
    echo "Done. All non-root HTTPS traffic now flows through transparent proxy."
    ;;
  stop)
    echo "Removing iptables redirect rules..."
    sudo iptables -t nat -D OUTPUT -p tcp --dport 443 -m owner ! --uid-owner root -j REDIRECT --to-port "$PROXY_PORT" 2>/dev/null || true
    sudo ip6tables -t nat -D OUTPUT -p tcp --dport 443 -m owner ! --uid-owner root -j REDIRECT --to-port "$PROXY_PORT" 2>/dev/null || true
    echo "Done. Traffic restored to normal."
    ;;
  *)
    echo "Usage: $0 [port] [start|stop]"
    echo "  port: transparent proxy port (default: 9092)"
    exit 1
    ;;
esac
