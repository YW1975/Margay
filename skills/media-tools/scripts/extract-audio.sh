#!/usr/bin/env bash
# Extract audio track from a video file.
# Usage: bash extract-audio.sh input.mp4 output.mp3
set -euo pipefail

command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not installed. Install with: brew install ffmpeg"; exit 1; }

INPUT="${1:?Usage: extract-audio.sh <input> <output.(mp3|aac|wav|flac|ogg)>}"
OUTPUT="${2:?Usage: extract-audio.sh <input> <output.(mp3|aac|wav|flac|ogg)>}"

[ -f "$INPUT" ] || { echo "Error: input file not found: $INPUT"; exit 1; }

echo "Extracting audio: $INPUT → $OUTPUT"
ffmpeg -y -i "$INPUT" -vn -q:a 2 "$OUTPUT" 2>/dev/null

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Done: $OUTPUT ($SIZE)"
