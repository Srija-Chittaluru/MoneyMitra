#!/usr/bin/env bash
# Start, stop, and inspect MoneyMitra (API + website in Docker, database on your Mac).
#
#   ./run_all.sh           build (if needed) and start everything
#   ./run_all.sh stop      stop everything (your data is kept)
#   ./run_all.sh logs      follow the live logs (Ctrl+C to stop watching)
#   ./run_all.sh status    show what is running
set -euo pipefail

cd "$(dirname "$0")"

bold=$'\033[1m'; green=$'\033[32m'; yellow=$'\033[33m'; red=$'\033[31m'; reset=$'\033[0m'
say()  { printf '%s\n' "$*"; }
fail() { printf '%s%s%s\n' "$red" "$*" "$reset" >&2; exit 1; }

require_docker() {
  command -v docker >/dev/null 2>&1 || fail "Docker is not installed. Install Docker Desktop first: https://www.docker.com/products/docker-desktop/"
  docker info >/dev/null 2>&1 || fail "Docker is installed but not running. Open the Docker Desktop app, wait until it says it is running, then try again."
}

# Value of KEY from .env, or a default if it is unset.
env_value() {
  local value
  value=$(grep -E "^$1=" .env 2>/dev/null | tail -n 1 | cut -d= -f2- || true)
  printf '%s' "${value:-$2}"
}

ensure_env_file() {
  [ -f .env ] && return
  [ -f .env.example ] || fail ".env.example is missing, so I can't create .env."
  local secret
  if command -v python3 >/dev/null 2>&1; then
    secret=$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')
  else
    secret=$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')
  fi
  sed "s|^JWT_SECRET=.*|JWT_SECRET=${secret}|" .env.example > .env
  say "${green}Created .env with a fresh JWT_SECRET.${reset} (It is git-ignored; never commit it.)"
}

port_in_use() {
  command -v lsof >/dev/null 2>&1 && lsof -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

# Only matters on a fresh start: if our own containers are already up, they own the ports.
check_ports() {
  [ -n "$(docker compose ps --status running -q 2>/dev/null)" ] && return
  local busy=0 name port
  for pair in "WEB_PORT:3000" "BACKEND_PORT:8000"; do
    name=${pair%%:*}; port=$(env_value "$name" "${pair##*:}")
    if port_in_use "$port"; then
      say "${yellow}Port $port ($name) is already in use by another program.${reset}"
      busy=1
    fi
  done
  [ "$busy" -eq 0 ] || fail "Edit the port(s) above in .env to free ones (e.g. WEB_PORT=3217), then run ./run_all.sh again."
}

# The database is the Postgres on this Mac (port 5432), not a container.
check_database() {
  port_in_use 5432 && return
  fail "No PostgreSQL is listening on port 5432. Start Postgres (e.g. open Postgres.app) and run ./run_all.sh again. No local Postgres? Run: docker compose -f apps/backend/docker-compose.yml up -d"
}

wait_until_ready() {
  local api="http://localhost:$(env_value BACKEND_PORT 8000)/api/v1/health"
  local site="http://localhost:$(env_value WEB_PORT 3000)"
  say "Waiting for everything to be ready..."
  for _ in $(seq 1 60); do
    if curl -fs "$api" >/dev/null 2>&1 && curl -fs -o /dev/null "$site" 2>/dev/null; then
      return 0
    fi
    sleep 2
  done
  say "${yellow}Not ready after 2 minutes. Recent logs:${reset}"
  docker compose logs --tail 30
  fail "Something did not start. Check the logs above, or run: ./run_all.sh logs"
}

start() {
  require_docker
  ensure_env_file
  check_ports
  check_database
  say "${bold}Starting MoneyMitra (the first build takes a few minutes)...${reset}"
  docker compose up -d --build --remove-orphans
  wait_until_ready
  say ""
  say "${green}${bold}MoneyMitra is running.${reset}"
  say "  Website:    http://localhost:$(env_value WEB_PORT 3000)"
  say "  API docs:   http://localhost:$(env_value BACKEND_PORT 8000)/docs"
  say ""
  say "  Stop:  ./run_all.sh stop     Logs:  ./run_all.sh logs     Status:  ./run_all.sh status"
}

case "${1:-start}" in
  start)  start ;;
  stop)   require_docker; docker compose down; say "Stopped. Your data is kept; run ./run_all.sh to start again." ;;
  logs)   require_docker; docker compose logs -f ;;
  status) require_docker; docker compose ps ;;
  *)      fail "Unknown command '$1'. Use: ./run_all.sh [start|stop|logs|status]" ;;
esac
