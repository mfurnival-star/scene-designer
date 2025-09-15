#!/bin/bash
# Scene Designer Deploy Script (robust: prod or dev)
# ---------------------------------------------------------------------------
# Supports both prod deployment (full build + deploy) and dev server (npm run dev).
# Usage:
#   ./deploy.sh [prod|dev] [env overrides...]
#   e.g. LOG_LEVEL=TRACE ./deploy.sh dev
#        ./deploy.sh prod
# ---------------------------------------------------------------------------

set -euo pipefail

PROJECT_DIR="$HOME/scene-designer"
BUILD_DIR="$PROJECT_DIR/dist"
DEPLOY_DIR="/var/www/scene-designer"
INDEX_HTML="$BUILD_DIR/index.html"
DATESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

DEFAULT_LOG_LEVEL="ERROR"
DEFAULT_LOG_DEST="console"
DEFAULT_LOG_SERVER_URL="http://143.47.247.184/logstream"
DEFAULT_LOG_SERVER_TOKEN=""
DEFAULT_INJECT_ERUDA=0

MODE="${1:-prod}"

if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then
  cat <<EOF
Usage: [VAR=VALUE ...] ./deploy.sh [prod|dev]

  prod     Build and deploy to nginx (default)
  dev      Start npm dev server with proper log/debug config

Environment variables (all optional, defaults shown):

  LOG_LEVEL        Log level (SILENT, ERROR, WARN, INFO, DEBUG, TRACE)   [$DEFAULT_LOG_LEVEL]
  LOG_DEST         Log destination (console, server, both)               [$DEFAULT_LOG_DEST]
  LOG_SERVER_URL   Log server URL                                        [$DEFAULT_LOG_SERVER_URL]
  LOG_SERVER_TOKEN Bearer token for server (if needed)                   [$DEFAULT_LOG_SERVER_TOKEN]
  INJECT_ERUDA     1 to add Eruda debug console, 0 otherwise             [$DEFAULT_INJECT_ERUDA]

Examples:
  LOG_LEVEL=TRACE ./deploy.sh dev
  LOG_LEVEL=SILENT ./deploy.sh prod
  LOG_LEVEL=ERROR ./deploy.sh prod
EOF
  exit 0
fi

LOG_LEVEL="${LOG_LEVEL:-$DEFAULT_LOG_LEVEL}"
LOG_DEST="${LOG_DEST:-$DEFAULT_LOG_DEST}"
LOG_SERVER_URL="${LOG_SERVER_URL:-$DEFAULT_LOG_SERVER_URL}"
LOG_SERVER_TOKEN="${LOG_SERVER_TOKEN:-$DEFAULT_LOG_SERVER_TOKEN}"
INJECT_ERUDA="${INJECT_ERUDA:-$DEFAULT_INJECT_ERUDA}"

# Validate LOG_LEVEL (must be one of the allowed, case-insensitive)
case "${LOG_LEVEL^^}" in
  SILENT|ERROR|WARN|INFO|DEBUG|TRACE) ;;
  *)
    echo "ERROR: LOG_LEVEL must be one of: SILENT, ERROR, WARN, INFO, DEBUG, TRACE"
    exit 1
    ;;
esac

cd "$PROJECT_DIR"

if [[ "$MODE" == "dev" ]]; then
  echo "[$DATESTAMP] === Starting DEV SERVER (npm run dev) with DEBUG_LOG_LEVEL=$LOG_LEVEL ==="
  export DEBUG_LOG_LEVEL="$LOG_LEVEL"
  export LOG_OUTPUT_DEST="$LOG_DEST"
  export LOG_SERVER_URL="$LOG_SERVER_URL"
  export LOG_SERVER_TOKEN="$LOG_SERVER_TOKEN"
  export INJECT_ERUDA="$INJECT_ERUDA"
  # Optionally inject these into a .env file for Vite/webpack
  cat > .env.local <<EOF
VITE_DEBUG_LOG_LEVEL=$LOG_LEVEL
VITE_LOG_OUTPUT_DEST=$LOG_DEST
VITE_LOG_SERVER_URL=$LOG_SERVER_URL
VITE_LOG_SERVER_TOKEN=$LOG_SERVER_TOKEN
VITE_INJECT_ERUDA=$INJECT_ERUDA
EOF
  echo "  (env written to .env.local)"
  npm run dev
  exit 0
fi

# Otherwise, normal prod build + deploy
echo "[$DATESTAMP] === Building project ==="
npm run build

echo "[$DATESTAMP] === Ensuring index.html exists in $BUILD_DIR ==="
if [ ! -f "$INDEX_HTML" ]; then
  cp "$PROJECT_DIR/index.html" "$INDEX_HTML"
  echo "Copied index.html to $INDEX_HTML"
fi

echo "[$DATESTAMP] === Injecting log config into $INDEX_HTML ==="
sed -i '/<!-- BEGIN LOG SETTINGS -->/,/<!-- END LOG SETTINGS -->/d' "$INDEX_HTML"

awk -v log_level="$LOG_LEVEL" \
    -v log_dest="$LOG_DEST" \
    -v log_server_url="$LOG_SERVER_URL" \
    -v log_server_token="$LOG_SERVER_TOKEN" \
    -v inject_eruda="$INJECT_ERUDA" \
    '
    /<head>/ {
        print;
        print "  <!-- BEGIN LOG SETTINGS -->";
        print "  <script>";
        print "    window._settings = window._settings || {};";
        print "    window._settings.DEBUG_LOG_LEVEL = \"" log_level "\";";
        print "    window._settings.LOG_OUTPUT_DEST = \"" log_dest "\";";
        print "    window._externalLogServerURL = \"" log_server_url "\";";
        print "    window._externalLogServerToken = \"" log_server_token "\";";
        print "  </script>";
        if (inject_eruda == "1") {
          print "  <script src=\"https://cdn.jsdelivr.net/npm/eruda\"></script>";
          print "  <script>eruda.init();</script>";
        }
        print "  <!-- END LOG SETTINGS -->";
        next;
    } 1
    ' "$INDEX_HTML" > "$INDEX_HTML.tmp" && mv "$INDEX_HTML.tmp" "$INDEX_HTML"

echo "[$DATESTAMP] === Verifying injected log config in $INDEX_HTML ==="
grep 'DEBUG_LOG_LEVEL\|LOG_OUTPUT_DEST\|externalLogServerURL\|externalLogServerToken' "$INDEX_HTML" || true

echo "[$DATESTAMP] === Deploying to $DEPLOY_DIR ==="
sudo rm -f "$DEPLOY_DIR/index.html"
sudo mkdir -p "$DEPLOY_DIR"
sudo rsync -av --delete "$BUILD_DIR/" "$DEPLOY_DIR/"

echo "[$DATESTAMP] === Verifying deployed index.html ==="
sudo grep 'DEBUG_LOG_LEVEL\|LOG_OUTPUT_DEST\|externalLogServerURL\|externalLogServerToken' "$DEPLOY_DIR/index.html" || true

echo "[$DATESTAMP] === Restarting nginx ==="
sudo systemctl restart nginx

echo "[$DATESTAMP] === Git add/commit/push ==="
git add .
git commit -m "Deploy at $DATESTAMP"
git push

echo "[$DATESTAMP] === Deployment complete! ==="
echo "App should be live at: http://143.47.247.184/scene-designer/"

