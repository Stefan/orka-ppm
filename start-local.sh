#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "🚀 Starte Orka PPM lokal..."
echo "=============================="

# Prüfe ob concurrently installiert ist
if ! npm list concurrently --silent 2>/dev/null; then
  echo "📦 Installiere concurrently..."
  npm install --save-dev concurrently
fi

echo "✅ Vorbereitungen abgeschlossen"
echo ""
echo "🔧 Starte Backend und Frontend..."
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Drücke Ctrl+C um zu stoppen"
echo ""

npm run dev:full
