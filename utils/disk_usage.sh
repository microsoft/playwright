#!/bin/bash

echo "=============================================================================="
echo "🔍 DIAGNOSTICS - System Resource Check"
echo "=============================================================================="

echo "--- 1. DISK SPACE USAGE (df -hT) ---"
df -hT

echo ""
echo "--- 2. INODE USAGE (df -i) ---"
df -i

echo ""
echo "--- 3. FILESYSTEM WATCHERS (sysctl) ---"
sysctl fs.inotify.max_user_watches
sysctl fs.inotify.max_user_instances

echo ""
echo "--- 4. DOCKER USAGE ---"
# Only run if Docker is available
if command -v docker &> /dev/null
then
    docker system df
fi

echo ""
echo "--- 5. HEAVIEST FOLDERS (Top 20 in current dir) ---"
# Find and print the top 20 largest folders (depth 3)
du -h -d 3 . | sort -hr | head -n 20
