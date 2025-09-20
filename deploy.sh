#!/bin/bash
# Scene Designer Deploy Script (prod or dev, auto FORCE settings/Eruda/Console.Re injection, clean-up logic)
# ---------------------------------------------------------------------------
# Usage:
#   [VAR=VALUE ...] ./deploy.sh [prod|dev]
#   e.g. DEBUG_LOG_LEVEL="Debug" LOG_OUTPUT_DEST=console INTERCEPT_CONSOLE=1 ./deploy.sh dev
#        (Alias supported: LOG_LEVEL maps to DEBUG_LOG_LEVEL)
#
# Notes:
# - Updated to support settings split (settings-core.js + settings-ui.js). We now parse settings-core.js first,
#   then fall back to settings.js for older builds.
# - Console.Re connector.js is injected as the first script in <head>, per transitional exception.
# ---------------------------------------------------------------------------

set -euo pipefail
#set -x
trap 'echo "Error on line $LINENO: $BASH_COMMAND"' ERR

PROJECT_DIR="$HOME/scene-designer"
BUILD_DIR="$PROJECT_DIR/dist"
DEPLOY_DIR="/var/www/scene-designer"

ROOT_INDEX_HTML="$PROJECT_DIR/index.html"
DIST_INDEX_HTML="$BUILD_DIR/index.html"

# Settings module paths (core-first, fallback to facade)
SETTINGS_CORE_JS="$PROJECT_DIR/src/settings-core.js"
SETTINGS_FACADE_JS="$PROJECT_DIR/src/settings.js"

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
  INJECT_ERUDA       1 to add Eruda debug console, 0 otherwise         [default: 0]
  INJECT_CONSOLERE   1 to add Console.Re log streaming, 0 otherwise    [default: 0]
  DEBUG_LOG_LEVEL    One of: Silent|Error|Warning|Info|Debug
  LOG_LEVEL          (alias for DEBUG_LOG_LEVEL)
  LOG_OUTPUT_DEST    console|both
  INTERCEPT_CONSOLE  1|0
  showDiagnosticLabels  true|false (etc.)
  <any other settings key found in src/settings-core.js settingsRegistry>

Examples:
  ./deploy.sh dev
  INJECT_ERUDA=1 ./deploy.sh dev
  DEBUG_LOG_LEVEL=Debug LOG_OUTPUT_DEST=both ./deploy.sh prod

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
    # Insert as the very first script in <head>
    awk '
      BEGIN { injected=0 }
      /<head>/ && injected==0 {
        print "<head>";
        print "  <!-- BEGIN CONSOLERE -->";
        print "  <script src=\"//console.re/connector.js\" data-channel=\"scene-designer\" id=\"consolerescript\"></script>";
        print "  <!-- END CONSOLERE -->";
        injected=1;
        next;
      }
      { print }
    ' "$INDEX_HTML" > "$INDEX_HTML.tmp" && mv "$INDEX_HTML.tmp" "$INDEX_HTML"
    echo "[$DATESTAMP] === Injected Console.Re connector.js as first script in <head> of $INDEX_HTML ==="
  else
    echo "[$DATESTAMP] === Console.Re injection not requested. Skipping. ==="
  fi
}

# Robust, portable parsing of settingsRegistry in src/settings-core.js (preferred) or src/settings.js (fallback).
# Extracts key/type pairs from entries like:
#   { key: "showDiagnosticLabels", label: "...", type: "boolean", default: false },
function _emit_settings_key_types_from_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    return 0
  fi
  awk '
    BEGIN { inReg=0; curKey=""; curType=""; }
    /export[[:space:]]+const[[:space:]]+settingsRegistry[[:space:]]*=/ { inReg=1; next; }
    inReg {
      if (match($0, /key:[[:space:]]*"([^"]+)"/, m)) { curKey=m[1]; }
      if (match($0, /type:[[:space:]]*"([^"]+)"/, m2)) { curType=m2[1]; }
      if ($0 ~ /},?[[:space:]]*$/) {
        if (curKey != "" && curType != "") {
          print curKey "\t" curType;
        }
        curKey=""; curType="";
      }
      if ($0 ~ /^\][[:space:]]*;/) { inReg=0; }
    }
  ' "$file"
}

function _emit_settings_key_types() {
  # Prefer core; then fallback to facade for older builds
  {
    _emit_settings_key_types_from_file "$SETTINGS_CORE_JS"
    _emit_settings_key_types_from_file "$SETTINGS_FACADE_JS"
  } | awk '!seen[$0]++'  # de-dup
}

function inject_force_settings_block() {
  echo "[$DATESTAMP] === Injecting FORCE settings from env vars matching settingsRegistry keys ==="
  sed -i '/<!-- BEGIN FORCE SETTINGS -->/,/<!-- END FORCE SETTINGS -->/d' "$INDEX_HTML"

  # LOG_LEVEL alias support
  if [[ -n "${LOG_LEVEL:-}" && -z "${DEBUG_LOG_LEVEL:-}" ]]; then
    export DEBUG_LOG_LEVEL="$LOG_LEVEL"
  fi

  # Build associative map of key -> type using AWK (portable, no PCRE)
  declare -A key_type
  while IFS=$'\t' read -r k t; do
    [[ -n "${k:-}" && -n "${t:-}" ]] && key_type["$k"]="$t"
  done < <(_emit_settings_key_types)

  # Construct the FORCE block
  local block="  <!-- BEGIN FORCE SETTINGS -->\n  <script>\n    window.SCENE_DESIGNER_FORCE = true;\n    window.SCENE_DESIGNER_FORCE_SETTINGS = window.SCENE_DESIGNER_FORCE_SETTINGS || {};\n"
  local injected=0

  if [[ ${#key_type[@]} -gt 0 ]]; then
    for key in "${!key_type[@]}"; do
      local setting_type="${key_type[$key]}"
      local value="${!key:-}"
      [[ -z "$value" ]] && continue
      if [[ "$setting_type" == "boolean" ]]; then
        case "$value" in
          1|true|TRUE|True) js_val="true" ;;
          0|false|FALSE|False) js_val="false" ;;
          *) js_val="false" ;;
        esac
        block+="    window.SCENE_DESIGNER_FORCE_SETTINGS[\"$key\"] = ${js_val};\n"
        echo "  [FORCE] $key (boolean) = $js_val"
      else
        # Everything else as string; settings-core coerces log level labels later
        block+="    window.SCENE_DESIGNER_FORCE_SETTINGS[\"$key\"] = \"${value}\";\n"
        echo "  [FORCE] $key = $value"
      fi
      injected=1
    done
  else
    # Fallback: best-effort for common keys if registry parse failed
    for key in DEBUG_LOG_LEVEL LOG_OUTPUT_DEST INTERCEPT_CONSOLE showErrorLogPanel showScenarioRunner showDiagnosticLabels canvasResponsive; do
      local value="${!key:-}"
      [[ -z "$value" ]] && continue
      case "$key" in
        INTERCEPT_CONSOLE|showErrorLogPanel|showScenarioRunner|showDiagnosticLabels|canvasResponsive)
          case "$value" in
            1|true|TRUE|True) js_val="true" ;;
            0|false|FALSE|False) js_val="false" ;;
            *) js_val="false" ;;
          esac
          block+="    window.SCENE_DESIGNER_FORCE_SETTINGS[\"$key\"] = ${js_val};\n"
          echo "  [FORCE] $key (boolean) = $js_val"
          ;;
        *)
          block+="    window.SCENE_DESIGNER_FORCE_SETTINGS[\"$key\"] = \"${value}\";\n"
          echo "  [FORCE] $key = $value"
          ;;
      esac
      injected=1
    done
  fi

  block+="  </script>\n  <!-- END FORCE SETTINGS -->"

  if [[ $injected -eq 1 ]]; then
    awk -v block="$block" '
      /<\/head>/ { print block }
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

