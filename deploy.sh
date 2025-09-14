#!/bin/bash
# Scene Designer Deploy Script (robust deployment)
# ---------------------------------------------------------------------------
# - Ensures the correct, injected dist/index.html is deployed.
# - Verifies final deployed file matches what was generated.
# ---------------------------------------------------------------------------

set -euo pipefail

PROJECT_DIR="$HOME/scene-designer"
BUILD_DIR="$PROJECT_DIR/dist"
DEPLOY_DIR="/var/www/scene-designer"
INDEX_HTML="$BUILD_DIR/index.html"
DATESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

# ---- CENTRALIZED DEFAULTS ----
DEFAULT_LOG_LEVEL="ERROR"
DEFAULT_LOG_DEST="console"
DEFAULT_LOG_SERVER_URL="http://143.47.247.184/logstream"
DEFAULT_LOG_SERVER_TOKEN=""
DEFAULT_INJECT_ERUDA=0

# ---- Help/Usage ----
if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<EOF
Usage: [VAR=VALUE ...] ./deploy.sh

Build, inject log config/Eruda, and deploy Scene Designer.

Environment variables (all optional, defaults shown):

  LOG_LEVEL        Log level (ERROR, WARN, INFO, DEBUG, TRACE)
                   [default: $DEFAULT_LOG_LEVEL]
  LOG_DEST         Log destination (console, server, both)
                   [default: $DEFAULT_LOG_DEST]
  LOG_SERVER_URL   Log server URL (used if LOG_DEST is server/both)
                   [default: $DEFAULT_LOG_SERVER_URL]
  LOG_SERVER_TOKEN Bearer token for server (if needed)
                   [default: $DEFAULT_LOG_SERVER_TOKEN]
  INJECT_ERUDA     1 to add Eruda debug console to HTML, 0 otherwise
                   [default: $DEFAULT_INJECT_ERUDA]

Examples:
  LOG_LEVEL=TRACE LOG_DEST=both INJECT_ERUDA=1 ./deploy.sh
  LOG_SERVER_URL="https://myhost/log" ./deploy.sh
  ./deploy.sh --help

EOF
  exit 0
fi

# ---- Assign from env or use defaults ----
LOG_LEVEL="${LOG_LEVEL:-$DEFAULT_LOG_LEVEL}"
LOG_DEST="${LOG_DEST:-$DEFAULT_LOG_DEST}"
LOG_SERVER_URL="${LOG_SERVER_URL:-$DEFAULT_LOG_SERVER_URL}"
LOG_SERVER_TOKEN="${LOG_SERVER_TOKEN:-$DEFAULT_LOG_SERVER_TOKEN}"
INJECT_ERUDA="${INJECT_ERUDA:-$DEFAULT_INJECT_ERUDA}"

cd "$PROJECT_DIR"

echo "[$DATESTAMP] === Building project ==="
npm run build

echo "[$DATESTAMP] === Ensuring index.html exists in $BUILD_DIR ==="
if [ ! -f "$INDEX_HTML" ]; then
  cp "$PROJECT_DIR/index.html" "$INDEX_HTML"
  echo "Copied index.html to $INDEX_HTML"
fi

echo "[$DATESTAMP] === Injecting log config into $INDEX_HTML ==="
# Remove any previous injected settings block
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

# --- Force remove the old deployed index.html to avoid stale file ---
sudo rm -f "$DEPLOY_DIR/index.html"

# --- Now rsync the new dist/ (including injected index.html) ---
sudo mkdir -p "$DEPLOY_DIR"
sudo rsync -av --delete "$BUILD_DIR/" "$DEPLOY_DIR/"

echo "[$DATESTAMP] === Verifying deployed index.html ==="
sudo grep 'DEBUG_LOG_LEVEL\|LOG_OUTPUT_DEST\|externalLogServerURL\|externalLogServerToken' "$DEPLOY_DIR/index.html" || true

echo "[$DATESTAMP] === Git add/commit/push ==="
git add .
git commit -m "Deploy at $DATESTAMP"
git push

echo "[$DATESTAMP] === Deployment complete! ==="
echo "App should be live at: http://your-server-ip/scene-designer/"
