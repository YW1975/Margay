#!/usr/bin/env bash
# Trim a video segment using ffmpeg (stream copy for speed).
# Usage: bash trim-video.sh input.mp4 output.mp4 00:00:10 00:00:30
set -euo pipefail

command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not installed. Install with: brew install ffmpeg"; exit 1; }

INPUT="${1:?Usage: trim-video.sh <input> <output> <start> <end>}"
OUTPUT="${2:?Usage: trim-video.sh <input> <output> <start> <end>}"
START="${3:?Usage: trim-video.sh <input> <output> <start> <end>}"
END="${4:?Usage: trim-video.sh <input> <output> <start> <end>}"

[ -f "$INPUT" ] || { echo "Error: input file not found: $INPUT"; exit 1; }

echo "Trimming: $INPUT [$START → $END] → $OUTPUT"
ffmpeg -y -i "$INPUT" -ss "$START" -to "$END" -c copy "$OUTPUT" 2>/dev/null

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Done: $OUTPUT ($SIZE)"
