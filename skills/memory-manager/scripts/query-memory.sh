#!/bin/bash
# Query available memory files across assistants and workspaces
# Usage: bash query-memory.sh [memory_base_dir]
#
# Default: uses ~/.margay-config/memory (symlink to platform config dir)
# Fallback chain: $1 > ~/.margay-config/memory > platform-specific path

if [ -n "$1" ]; then
  MEMORY_DIR="$1"
elif [ -d "$HOME/.margay-config/memory" ]; then
  MEMORY_DIR="$HOME/.margay-config/memory"
elif [ "$(uname)" = "Darwin" ]; then
  MEMORY_DIR="$HOME/Library/Application Support/Margay/config/memory"
else
  MEMORY_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/Margay/config/memory"
fi

if [ ! -d "$MEMORY_DIR" ]; then
  echo "No memory directory found at: $MEMORY_DIR"
  exit 0
fi

echo "=== Assistant Memories (L2) ==="
ASSISTANT_DIR="$MEMORY_DIR/assistant"
if [ -d "$ASSISTANT_DIR" ]; then
  for dir in "$ASSISTANT_DIR"/*/; do
    [ -d "$dir" ] || continue
    name=$(basename "$dir")
    mem_file="$dir/MEMORY.md"
    if [ -f "$mem_file" ]; then
      size=$(wc -c < "$mem_file" | tr -d ' ')
      lines=$(wc -l < "$mem_file" | tr -d ' ')
      echo "  $name: ${lines} lines, ${size} bytes"
    else
      echo "  $name: (empty)"
    fi
  done
else
  echo "  (none)"
fi

echo ""
echo "=== Workspace Memories (L3) ==="
WORKSPACE_DIR="$MEMORY_DIR/workspace"
if [ -d "$WORKSPACE_DIR" ]; then
  for dir in "$WORKSPACE_DIR"/*/; do
    [ -d "$dir" ] || continue
    hash=$(basename "$dir")
    mem_file="$dir/MEMORY.md"
    if [ -f "$mem_file" ]; then
      size=$(wc -c < "$mem_file" | tr -d ' ')
      lines=$(wc -l < "$mem_file" | tr -d ' ')
      echo "  $hash: ${lines} lines, ${size} bytes"
    else
      echo "  $hash: (empty)"
    fi
  done
else
  echo "  (none)"
fi
