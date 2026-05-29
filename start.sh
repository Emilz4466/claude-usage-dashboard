#!/usr/bin/env bash
# Jednokomendowe uruchomienie: instaluje zaleznosci (jesli brak),
# buduje frontend i startuje serwer. Uzycie: ./start.sh
# Zmienne srodowiskowe (PORT, CLAUDE_CONFIG_DIR, ...) sa przekazywane dalej.
set -euo pipefail
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "→ instaluję zależności…"
  npm install
fi

echo "→ buduję frontend…"
npm run build

echo "→ startuję serwer…"
exec node server.js
