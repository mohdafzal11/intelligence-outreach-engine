#!/bin/sh
# Run the app from a path that does not contain "!" (Webpack restriction).
# Builds then starts so you get a working localhost.
# Usage: npm run dev:safe
set -e
DEST="${HOME}/outreach-engine"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
echo "Copying project to $DEST (path without special chars)..."
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$PROJECT_DIR" "$DEST"
cd "$DEST"
echo "Building..."
npm run build
echo ""
PORT="${PORT:-3030}"
echo "Starting server at http://localhost:$PORT"
echo "Open that URL in your browser."
exec env PORT="$PORT" npm run start
