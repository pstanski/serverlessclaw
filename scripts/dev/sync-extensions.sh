#!/bin/bash
# sync-extensions.sh: Sync project-specific extensions and assets into the dashboard.
set -e

EXT_SOURCE=$1
DEST_DIR="src/extensions/project"
PUBLIC_DIR="public"

if [ -z "$EXT_SOURCE" ] || [ "$EXT_SOURCE" == "none" ]; then
    echo "[INFO] No extension source provided. Skipping sync."
    exit 0
fi

echo "[INFO] Syncing extensions from $EXT_SOURCE..."
mkdir -p "$DEST_DIR"

# Sync public assets if they exist
if [ -d "../../../$EXT_SOURCE/public" ]; then
    echo "[INFO] Syncing public assets..."
    cp -rfL "../../../$EXT_SOURCE/public/." "$PUBLIC_DIR/"
fi

# Sync extension source code (excluding node_modules)
if command -v rsync >/dev/null 2>&1; then
    echo "[INFO] Using rsync for source sync..."
    rsync -aL --exclude="node_modules" "../../../$EXT_SOURCE/" "$DEST_DIR/"
else
    echo "[INFO] Using cp for source sync (rsync missing)..."
    cp -rfL "../../../$EXT_SOURCE/." "$DEST_DIR/"
    rm -rf "$DEST_DIR/node_modules"
fi

# Sync jobs configuration
if [ -f "../../../$EXT_SOURCE/jobs.config.json" ]; then
    echo "[INFO] Syncing jobs.config.json..."
    cp -fL "../../../$EXT_SOURCE/jobs.config.json" .
fi

echo "[SUCCESS] Synchronization complete."
