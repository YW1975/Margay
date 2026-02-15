#!/usr/bin/env bash
# Extract frames from a video as individual images.
# Usage: bash extract-frames.sh input.mp4 output_dir/ 1
# Args: <input> <output_dir> <fps> (1 = 1 frame/sec, 0.1 = 1 frame/10sec)
set -euo pipefail

command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not installed. Install with: brew install ffmpeg"; exit 1; }

INPUT="${1:?Usage: extract-frames.sh <input> <output_dir> <fps>}"
OUTDIR="${2:?Usage: extract-frames.sh <input> <output_dir> <fps>}"
FPS="${3:?Usage: extract-frames.sh <input> <output_dir> <fps>}"

[ -f "$INPUT" ] || { echo "Error: input file not found: $INPUT"; exit 1; }

mkdir -p "$OUTDIR"

echo "Extracting frames at ${FPS} fps: $INPUT → $OUTDIR/"
ffmpeg -y -i "$INPUT" -vf "fps=${FPS}" "$OUTDIR/frame_%04d.png" 2>/dev/null

COUNT=$(ls -1 "$OUTDIR"/frame_*.png 2>/dev/null | wc -l | tr -d ' ')
echo "Done: $COUNT frames extracted to $OUTDIR/"
