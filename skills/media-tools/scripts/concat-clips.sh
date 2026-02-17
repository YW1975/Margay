#!/usr/bin/env bash
# Concatenate multiple video files into one using ffmpeg.
# Usage: bash concat-clips.sh output.mp4 clip1.mp4 clip2.mp4 [clip3.mp4 ...]
set -euo pipefail

command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not installed. Install with: brew install ffmpeg"; exit 1; }

OUTPUT="${1:?Usage: concat-clips.sh <output> <input1> <input2> [input3...]}"
shift

[ $# -ge 2 ] || { echo "Error: need at least 2 input files"; exit 1; }

# Verify all inputs exist
for f in "$@"; do
  [ -f "$f" ] || { echo "Error: input file not found: $f"; exit 1; }
done

# Create concat list
FILELIST=$(mktemp -t concat.XXXXXX).txt
trap 'rm -f "$FILELIST"' EXIT

for f in "$@"; do
  echo "file '$(realpath "$f")'" >> "$FILELIST"
done

echo "Concatenating $# clips → $OUTPUT"
ffmpeg -y -f concat -safe 0 -i "$FILELIST" -c copy "$OUTPUT" 2>/dev/null

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Done: $OUTPUT ($SIZE)"
