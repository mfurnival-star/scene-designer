#!/bin/bash
# Diagnostic script for Scene Designer deploy workflow
# Collects full env, key files, log injection steps/results

set -euo pipefail

OUT="deploy_debug_report.txt"
echo "==== [Deploy Debug Report] $(date) ====" > "$OUT"

echo -e "\n--- ENVIRONMENT VARIABLES ---" >> "$OUT"
env | grep -E '^LOG_|^INJECT_ERUDA|^PATH|^USER|^HOME' >> "$OUT"

echo -e "\n--- CURRENT DIRECTORY ---" >> "$OUT"
pwd >> "$OUT"

echo -e "\n--- deploy.sh CONTENTS ---" >> "$OUT"
if [ -f deploy.sh ]; then
  cat deploy.sh >> "$OUT"
else
  echo "deploy.sh not found." >> "$OUT"
fi

echo -e "\n--- index.html (PROJECT ROOT, PRE-BUILD) ---" >> "$OUT"
if [ -f index.html ]; then
  cat index.html >> "$OUT"
else
  echo "index.html not found." >> "$OUT"
fi

echo -e "\n--- dist/index.html (PRE-BUILD/INJECTION) ---" >> "$OUT"
if [ -f dist/index.html ]; then
  cat dist/index.html >> "$OUT"
else
  echo "dist/index.html not found." >> "$OUT"
fi

echo -e "\n--- Running: npm run build ---" >> "$OUT"
npm run build >> "$OUT" 2>&1 || echo "npm run build failed" >> "$OUT"

echo -e "\n--- dist/index.html (AFTER BUILD, PRE-INJECTION) ---" >> "$OUT"
if [ -f dist/index.html ]; then
  cat dist/index.html >> "$OUT"
else
  echo "dist/index.html not found." >> "$OUT"
fi

echo -e "\n--- Running: LOG_LEVEL=TRACE LOG_DEST=both INJECT_ERUDA=1 ./deploy.sh ---" >> "$OUT"
LOG_LEVEL=TRACE LOG_DEST=both INJECT_ERUDA=1 ./deploy.sh >> "$OUT" 2>&1 || echo "./deploy.sh failed" >> "$OUT"

echo -e "\n--- dist/index.html (AFTER INJECTION) ---" >> "$OUT"
if [ -f dist/index.html ]; then
  cat dist/index.html >> "$OUT"
else
  echo "dist/index.html not found." >> "$OUT"
fi

echo -e "\n--- /var/www/scene-designer/index.html (DEPLOYED) ---" >> "$OUT"
if [ -f /var/www/scene-designer/index.html ]; then
  cat /var/www/scene-designer/index.html >> "$OUT"
else
  echo "/var/www/scene-designer/index.html not found." >> "$OUT"
fi

echo -e "\n--- grep LOG_LEVEL and LOG_OUTPUT_DEST in all index.html files ---" >> "$OUT"
grep -H 'LOG_LEVEL\|LOG_OUTPUT_DEST' index.html dist/index.html /var/www/scene-designer/index.html 2>>"$OUT" || true

echo -e "\n--- grep BEGIN LOG SETTINGS in all index.html files ---" >> "$OUT"
grep -H 'BEGIN LOG SETTINGS' index.html dist/index.html /var/www/scene-designer/index.html 2>>"$OUT" || true

echo -e "\n==== END OF REPORT ====" >> "$OUT"

echo "Diagnostic report saved to $OUT"
