#!/bin/bash
# Scene Designer Deploy Script
# ---------------------------------------
# - Builds Vite project
# - Rsyncs fresh dist/ output to /var/www/scene-designer/
# - (Optional) Git commit/push
# - Logs everything
# ---------------------------------------

set -euo pipefail

PROJECT_DIR="$HOME/scene-designer"
BUILD_DIR="$PROJECT_DIR/dist"
DEPLOY_DIR="/var/www/scene-designer"
DATESTAMP=$(date +"%Y-%m-%d %H:%M:%S")

cd "$PROJECT_DIR"

echo "[$DATESTAMP] === Building Vite project ==="
npm run build

echo "[$DATESTAMP] === Deploying to $DEPLOY_DIR ==="
sudo mkdir -p "$DEPLOY_DIR"
sudo rsync -av --delete "$BUILD_DIR/" "$DEPLOY_DIR/"

echo "[$DATESTAMP] === Git add/commit/push ==="
git add .
git commit -m "Deploy at $DATESTAMP"
git push

echo "[$DATESTAMP] === Deployment complete! ==="
echo "App should be live at: http://your-server-ip/scene-designer/"
