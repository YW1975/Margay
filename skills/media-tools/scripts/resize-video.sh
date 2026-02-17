#!/usr/bin/env bash
# Resize/scale a video to specific dimensions.
# Usage: bash resize-video.sh input.mp4 output.mp4 1280 720
# Use -1 for width or height to auto-scale: resize-video.sh in.mp4 out.mp4 720 -1
set -euo pipefail

command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not installed. Install with: brew install ffmpeg"; exit 1; }

INPUT="${1:?Usage: resize-video.sh <input> <output> <width> <height>}"
OUTPUT="${2:?Usage: resize-video.sh <input> <output> <width> <height>}"
WIDTH="${3:?Usage: resize-video.sh <input> <output> <width> <height>}"
HEIGHT="${4:?Usage: resize-video.sh <input> <output> <width> <height>}"

[ -f "$INPUT" ] || { echo "Error: input file not found: $INPUT"; exit 1; }

echo "Resizing: $INPUT → ${WIDTH}x${HEIGHT} → $OUTPUT"
ffmpeg -y -i "$INPUT" -vf "scale=${WIDTH}:${HEIGHT}" -c:a copy "$OUTPUT" 2>/dev/null

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Done: $OUTPUT ($SIZE)"
