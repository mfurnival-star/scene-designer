#!/bin/bash
# Scene Designer Deploy Script (prod or dev, auto FORCE settings/Eruda/Console.Re injection, clean-up logic)
# ---------------------------------------------------------------------------
# Usage:
#   [VAR=VALUE ...] ./deploy.sh [prod|dev]
#   e.g. LOG_LEVEL="Debug" LOG_OUTPUT_DEST=console INTERCEPT_CONSOLE=1 ./deploy.sh dev
# ---------------------------------------------------------------------------

set -euo pipefail
#set -x
trap 'echo "Error on line $LINENO: $BASH_COMMAND"' ERR


PROJECT_DIR="$HOME/scene-designer"
BUILD_DIR="$PROJECT_DIR/dist"
DEPLOY_DIR="/var/www/scene-designer"

ROOT_INDEX_HTML="$PROJECT_DIR/index.html"
DIST_INDEX_HTML="$BUILD_DIR/index.html"
SETTINGS_JS="$PROJECT_DIR/src/settings.js"
DATESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

MODE="${1:-prod}"
if [[ $# -gt 0 ]]; then shift; fi

INJECT_ERUDA="${INJECT_ERUDA:-0}"
INJECT_CONSOLERE="${INJECT_CONSOLERE:-0}"

function usage() {
  cat <<EOF
Usage: [VAR=VALUE ...] ./deploy.sh [prod|dev]

  prod     Build and deploy to nginx (default)
  dev      Just git add/commit/push, inject Eruda and FORCE settings, then start dev server (npm run dev)

Environment variables:
  INJECT_ERUDA     1 to add Eruda debug console, 0 otherwise   [default: 0]
  INJECT_CONSOLERE 1 to add Console.Re log streaming, 0 otherwise
  <any FORCE setting key>
    e.g. LOG_LEVEL, LOG_OUTPUT_DEST, INTERCEPT_CONSOLE

Examples:
  ./deploy.sh dev
  INJECT_ERUDA=1 ./deploy.sh dev
  INJECT_ERUDA=1 ./deploy.sh prod

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
  if [ ! -f "$DIST_INDEX_HTML" ]; then
    cp "$ROOT_INDEX_HTML" "$DIST_INDEX_HTML"
    echo "Copied index.html to $DIST_INDEX_HTML"
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

function inject_consolere() {
  echo "[$DATESTAMP] === (Re)inserting Console.Re (if enabled) ==="
  sed -i '/<!-- BEGIN CONSOLERE -->/,/<!-- END CONSOLERE -->/d' "$INDEX_HTML"
  if [[ "$INJECT_CONSOLERE" == "1" ]]; then
    awk '
      /<head>/ {
        print "<head>";
        print "  <!-- BEGIN CONSOLERE -->";
        print "  <script src=\"//console.re/connector.js\" data-channel=\"scene-designer\" id=\"consolerescript\"></script>";
        print "  <!-- END CONSOLERE -->";
        next;
      }
      { print }
    ' "$INDEX_HTML" > "$INDEX_HTML.tmp" && mv "$INDEX_HTML.tmp" "$INDEX_HTML"
    echo "[$DATESTAMP] === Injected Console.Re connector.js as first script in <head> of $INDEX_HTML ==="
  else
    echo "[$DATESTAMP] === Console.Re injection not requested. Skipping. ==="
  fi
}

function inject_force_settings_block() {
  echo "[$DATESTAMP] === Injecting FORCE settings from env vars matching settings.js keys ==="
  sed -i '/<!-- BEGIN FORCE SETTINGS -->/,/<!-- END FORCE SETTINGS -->/d' "$INDEX_HTML"
  local keys types
  keys=$(grep -oP 'key:\s*"\K[^"]+' "$SETTINGS_JS" | sort | uniq)
  types=$(grep -oP 'type:\s*"\K[^"]+' "$SETTINGS_JS" | paste -d, -s)
  declare -A key_type
  while read -r line; do
    key=$(echo "$line" | grep -oP 'key:\s*"\K[^"]+')
    type=$(echo "$line" | grep -oP 'type:\s*"\K[^"]+')
    if [[ -n "$key" && -n "$type" ]]; then
      key_type["$key"]="$type"
    fi
  done < <(grep -E 'key:|type:' "$SETTINGS_JS" | paste - -)
  echo "HERE"
  local block="  <!-- BEGIN FORCE SETTINGS -->\n  <script>\n    window.SCENE_DESIGNER_FORCE = true;\n    window.SCENE_DESIGNER_FORCE_SETTINGS = window.SCENE_DESIGNER_FORCE_SETTINGS || {};\n"
  local injected=0
  for key in $keys; do
    value="${!key:-}"
    if [[ -n "$value" ]]; then
      setting_type="${key_type[$key]:-text}"
      if [[ "$setting_type" == "boolean" ]]; then
        case "$value" in
          1|true|TRUE) js_val="true";;
          0|false|FALSE) js_val="false";;
          *) js_val="false";;
        esac
        block+="    window.SCENE_DESIGNER_FORCE_SETTINGS[\"$key\"] = ${js_val};\n"
        echo "  [FORCE] $key (boolean) = $js_val"
      else
        block+="    window.SCENE_DESIGNER_FORCE_SETTINGS[\"$key\"] = \"${value}\";\n"
        echo "  [FORCE] $key = $value"
      fi
      injected=1
    fi
  done
  block+="  </script>\n  <!-- END FORCE SETTINGS -->"
  if [[ $injected -eq 1 ]]; then
    awk -v block="$block" '
      /<\/head>/ {
        print block;
      }
      { print }
    ' "$INDEX_HTML" > "$INDEX_HTML.tmp" && mv "$INDEX_HTML.tmp" "$INDEX_HTML"
    echo "[$DATESTAMP] === FORCE settings injected into $INDEX_HTML ==="
  else
    echo "[$DATESTAMP] === No FORCE settings found in env. Previous block removed. ==="
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
  export INJECT_CONSOLERE="$INJECT_CONSOLERE"
  cat > .env.local <<EOF
VITE_INJECT_ERUDA=$INJECT_ERUDA
VITE_INJECT_CONSOLERE=$INJECT_CONSOLERE
EOF
  echo "  (env written to .env.local)"
  npm run dev
}

if [[ "$MODE" == "-h" || "$MODE" == "--help" ]]; then usage; fi

git_commit_push

if [[ "$MODE" == "prod" ]]; then
  INDEX_HTML="$DIST_INDEX_HTML"
  build_project
  prepare_index_html
  inject_consolere   # Inject Console.Re connector.js as FIRST script in <head>
  inject_eruda
  inject_force_settings_block
  deploy_to_prod
else
  INDEX_HTML="$ROOT_INDEX_HTML"
  prepare_index_html
  inject_consolere   # Inject Console.Re connector.js as FIRST script in <head>
  inject_eruda
  inject_force_settings_block
  start_dev_server
fi

exit 0
