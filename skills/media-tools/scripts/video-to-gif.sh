#!/usr/bin/env bash
# Convert video to animated GIF using ffmpeg.
# Usage: bash video-to-gif.sh input.mp4 output.gif
# Environment: FPS=15 WIDTH=480 START=0 DURATION=(full)
set -euo pipefail

command -v ffmpeg >/dev/null 2>&1 || { echo "Error: ffmpeg is not installed. Install with: brew install ffmpeg"; exit 1; }

INPUT="${1:?Usage: video-to-gif.sh <input> <output.gif>}"
OUTPUT="${2:?Usage: video-to-gif.sh <input> <output.gif>}"
FPS="${FPS:-15}"
WIDTH="${WIDTH:-480}"
START="${START:-0}"

[ -f "$INPUT" ] || { echo "Error: input file not found: $INPUT"; exit 1; }

# Build ffmpeg args
ARGS=(-i "$INPUT" -ss "$START")
[ -n "${DURATION:-}" ] && ARGS+=(-t "$DURATION")

# Two-pass GIF for quality: generate palette then use it
PALETTE=$(mktemp -t palette.XXXXXX).png
trap 'rm -f "$PALETTE"' EXIT

echo "Generating palette..."
ffmpeg -y "${ARGS[@]}" -vf "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos,palettegen" "$PALETTE" 2>/dev/null

echo "Creating GIF..."
ffmpeg -y "${ARGS[@]}" -i "$PALETTE" -lavfi "fps=${FPS},scale=${WIDTH}:-1:flags=lanczos [x]; [x][1:v] paletteuse" "$OUTPUT" 2>/dev/null

SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "Done: $OUTPUT ($SIZE)"
