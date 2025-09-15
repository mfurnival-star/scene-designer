#!/bin/bash
# Scene Designer Deploy Script (prod or dev, robust and functional)
# ---------------------------------------------------------------------------
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

MODE="${1:-prod}"
shift || true

INJECT_ERUDA="${INJECT_ERUDA:-0}"

function usage() {
  cat <<EOF
Usage: [VAR=VALUE ...] ./deploy.sh [prod|dev]

  prod     Build and deploy to nginx (default)
  dev      Just git add/commit/push, then start dev server (npm run dev)

Environment variables:

  INJECT_ERUDA     1 to add Eruda debug console, 0 otherwise   [default: 0]

Examples:
  INJECT_ERUDA=1 ./deploy.sh prod
  INJECT_ERUDA=1 ./deploy.sh dev

EOF
  exit 0
}

function git_commit_push() {
  echo "[$DATESTAMP] === Git add/commit/push ==="
  cd "$PROJECT_DIR"
  git add .
  git commit -m "Deploy at $DATESTAMP"
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
  # Remove any previous Eruda injection (between the known comment and the end of head)
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
  # Optionally inject into .env for Vite/webpack
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
  deploy_to_prod
else
  start_dev_server
fi
