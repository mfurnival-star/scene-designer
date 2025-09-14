#!/bin/bash
# Comprehensive deploy + environment debug for Scene Designer
# Usage: bash deploy_mega_debug.sh

OUT="deploy_mega_debug_full.txt"
set -x
{
echo "==== [Deploy Mega Debug Report] $(date) ===="

echo -e "\n--- ENVIRONMENT VARIABLES ---"
env

echo -e "\n--- CURRENT DIRECTORY ---"
pwd

echo -e "\n--- GIT STATUS ---"
git status

echo -e "\n--- GIT REMOTES ---"
git remote -v

echo -e "\n--- GIT CONFIG ---"
git config --list

echo -e "\n--- GIT HOOKS (local repo) ---"
find .git/hooks -type f -exec ls -l {} \; 2>/dev/null
for h in .git/hooks/*; do
  [ -f "$h" ] && echo "--- $h ---" && cat "$h"
done

echo -e "\n--- LIST OF ALL 'index.html' FILES IN PROJECT AND /var/www ---"
find . /var/www/scene-designer /var/www /home/ubuntu/scene-designer -name index.html 2>/dev/null | tee /tmp/index_locations.txt

echo -e "\n--- SHA256 HASHES AND PERMS OF ALL FOUND index.html FILES ---"
while read -r f; do
  echo "--- $f ---"
  ls -lh "$f"
  stat "$f"
  sha256sum "$f"
  head -20 "$f"
  echo
done < /tmp/index_locations.txt

echo -e "\n--- GIT LOG (last 10) ---"
git log -10 --oneline --decorate --graph

echo -e "\n--- GIT HOOKS (relay repo if exists) ---"
if [ -d /opt/git/scene-designer.git/hooks ]; then
  find /opt/git/scene-designer.git/hooks -type f -exec ls -l {} \; 2>/dev/null
  for h in /opt/git/scene-designer.git/hooks/*; do
    [ -f "$h" ] && echo "--- $h ---" && cat "$h"
  done
fi

echo -e "\n--- SYSTEM CRONJOBS (current user and root) ---"
crontab -l || echo "no user crontab"
sudo crontab -l || echo "no root crontab"

echo -e "\n--- RUNNING PROCESSES (grep: scene|www|rsync) ---"
ps auxww | grep -E 'scene|www|rsync' | grep -v grep

echo -e "\n--- WEB ROOT DIRECTORY LISTING ---"
/bin/ls -lah /var/www/scene-designer

echo -e "\n--- PERMISSIONS FOR /var/www/scene-designer AND index.html ---"
ls -ld /var/www/scene-designer
ls -l /var/www/scene-designer/index.html

echo -e "\n--- GIT PUSH VERBOSE TEST (dry run, if possible) ---"
git push --dry-run --verbose

echo -e "\n--- RUNNING DEPLOY SCRIPT (with xtrace) ---"
set -x
LOG_LEVEL=TRACE LOG_DEST=both INJECT_ERUDA=1 ./deploy.sh

echo -e "\n--- WAIT 5s, THEN CHECK index.html AGAIN ---"
sleep 5
if [ -f /var/www/scene-designer/index.html ]; then
  sha256sum /var/www/scene-designer/index.html
  head -20 /var/www/scene-designer/index.html
  stat /var/www/scene-designer/index.html
fi

echo -e "\n--- NETWORK LISTENERS (to see if any service is watching /var/www) ---"
sudo lsof -nP -iTCP -sTCP:LISTEN | grep www

echo -e "\n--- END OF DEBUG ---"
} > "$OUT" 2>&1

echo
echo "==== Debug info collected in $OUT ===="
echo "Please upload this file for analysis."

