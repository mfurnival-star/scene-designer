#!/bin/bash
# Scene Designer Deploy Script (prod or dev, auto FORCE settings injection)
# ---------------------------------------------------------------------------
# Usage:
#   [VAR=VALUE ...] ./deploy.sh [prod|dev]
#   e.g. LOG_LEVEL="Trace (very verbose)" LOG_OUTPUT_DEST=server LOG_SERVER_URL="http://..." ./deploy.sh dev
# ---------------------------------------------------------------------------

set -euo pipefail

PROJECT_DIR="$HOME/scene-designer"
BUILD_DIR="$PROJECT_DIR/dist"
DEPLOY_DIR="/var/www/scene-designer"
INDEX_HTML="$BUILD_DIR/index.html"
SETTINGS_JS="$PROJECT_DIR/src/settings.js"
DATESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

MODE="${1:-prod}"
if [[ $# -gt 0 ]]; then shift; fi

INJECT_ERUDA="${INJECT_ERUDA:-0}"

function usage() {
  cat <<EOF
Usage: [VAR=VALUE ...] ./deploy.sh [prod|dev]

  prod     Build and deploy to nginx (default)
  dev      Just git add/commit/push, inject Eruda and FORCE settings, then start dev server (npm run dev)

Environment variables:
  INJECT_ERUDA     1 to add Eruda debug console, 0 otherwise   [default: 0]
  <any FORCE setting key>
    e.g. LOG_LEVEL, LOG_OUTPUT_DEST, LOG_SERVER_URL, INTERCEPT_CONSOLE

Examples:
  INJECT_ERUDA=1 ./deploy.sh prod
  LOG_LEVEL="Trace (very verbose)" LOG_OUTPUT_DEST=server ./deploy.sh dev

EOF
  exit 0
}

function git_commit_push() {
  echo "[$DATESTAMP] === Git add/commit/push ==="
  cd "$PROJECT_DIR"
  git add .
  git commit -m "Deploy at $DATESTAMP" || true
  git push
}

function build_project() {
  echo "[$DATESTAMP] === Building project ==="
  cd "$PROJECT_DIR"
  npm run build
}

function prepare_index_html() {
  echo "[$DATESTAMP] === Ensuring index.html exists in $BUILD_DIR ==="
  if [ ! -f "$INDEX_HTML" ]; then
    cp "$PROJECT_DIR/index.html" "$INDEX_HTML"
    echo "Copied index.html to $INDEX_HTML"
  fi
}

function inject_eruda() {
  echo "[$DATESTAMP] === (Re)inserting Eruda (if enabled) ==="
  sed -i '/<!-- BEGIN ERUDA -->/,/<!-- END ERUDA -->/d' "$INDEX_HTML"
  if [[ "$INJECT_ERUDA" == "1" ]]; then
    awk '
      /<\/head>/ {
        print "  <!-- BEGIN ERUDA -->";
        print "  <script src=\"https://cdn.jsdelivr.net/npm/eruda\"></script>";
        print "  <script>eruda.init();</script>";
        print "  <!-- END ERUDA -->";
      }
      { print }
    ' "$INDEX_HTML" > "$INDEX_HTML.tmp" && mv "$INDEX_HTML.tmp" "$INDEX_HTML"
    echo "[$DATESTAMP] === Injected Eruda debug console into $INDEX_HTML ==="
  else
    echo "[$DATESTAMP] === Eruda injection not requested. Skipping. ==="
  fi
}

function inject_force_settings_block() {
  echo "[$DATESTAMP] === Injecting FORCE settings from env vars matching settings.js keys ==="
  # Remove any previous force block
  sed -i '/<!-- BEGIN FORCE SETTINGS -->/,/<!-- END FORCE SETTINGS -->/d' "$INDEX_HTML"
  # Extract all setting keys from settings.js
  local keys
  keys=$(grep -oP 'key:\s*"\K[^"]+' "$SETTINGS_JS" | sort | uniq)
  local block="  <!-- BEGIN FORCE SETTINGS -->\n  <script>\n    window.SCENE_DESIGNER_FORCE = true;\n    window.SCENE_DESIGNER_FORCE_SETTINGS = window.SCENE_DESIGNER_FORCE_SETTINGS || {};\n"
  local injected=0
  for key in $keys; do
    # Transform to env var name convention if needed (exact match)
    value="${!key:-}"
    if [[ -n "$value" ]]; then
      block+="    window.SCENE_DESIGNER_FORCE_SETTINGS[\"$key\"] = \"${value}\";\n"
      injected=1
      echo "  [FORCE] $key = $value"
    fi
  done
  block+="  </script>\n  <!-- END FORCE SETTINGS -->"
  if [[ $injected -eq 1 ]]; then
    # Insert block just before </head>
    awk -v block="$block" '
      /<\/head>/ {
        print block;
      }
      { print }
    ' "$INDEX_HTML" > "$INDEX_HTML.tmp" && mv "$INDEX_HTML.tmp" "$INDEX_HTML"
    echo "[$DATESTAMP] === FORCE settings injected into $INDEX_HTML ==="
  else
    # Remove any old block if present
    sed -i '/<!-- BEGIN FORCE SETTINGS -->/,/<!-- END FORCE SETTINGS -->/d' "$INDEX_HTML"
    echo "[$DATESTAMP] === No FORCE settings found in env. ==="
  fi
}

function deploy_to_prod() {
  echo "[$DATESTAMP] === Deploying to $DEPLOY_DIR ==="
  sudo rm -f "$DEPLOY_DIR/index.html"
  sudo mkdir -p "$DEPLOY_DIR"
  sudo rsync -av --delete "$BUILD_DIR/" "$DEPLOY_DIR/"
  echo "[$DATESTAMP] === Deployment complete! ==="
  echo "App should be live at: http://143.47.247.184/scene-designer/"
  echo "[$DATESTAMP] === Restarting nginx ==="
  sudo systemctl restart nginx
}

function start_dev_server() {
  echo "[$DATESTAMP] === Starting DEV SERVER (npm run dev) ==="
  export INJECT_ERUDA="$INJECT_ERUDA"
  cat > .env.local <<EOF
VITE_INJECT_ERUDA=$INJECT_ERUDA
EOF
  echo "  (env written to .env.local)"
  npm run dev
}

# --- Main logic ---
if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then usage; fi

git_commit_push

if [[ "$MODE" == "prod" ]]; then
  build_project
  prepare_index_html
  inject_eruda
  inject_force_settings_block
  deploy_to_prod
else
  # DEV MODE: ensure dist/index.html is available and inject scripts
  prepare_index_html
  inject_eruda
  inject_force_settings_block
  start_dev_server
fi

exit 0
