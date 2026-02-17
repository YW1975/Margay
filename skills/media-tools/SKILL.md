---
name: media-tools
description: Video and image processing with ffmpeg — convert video to GIF, trim clips, concatenate videos, extract audio, and resize media. Use when user asks to create GIFs, edit videos, extract frames, or process media files.
dependencies:
  - type: bin
    name: ffmpeg
    install: 'brew install ffmpeg'
---

# Media Tools Skill

Video and image processing utilities powered by `ffmpeg`.

## Prerequisites

Install ffmpeg:

```bash
# macOS
brew install ffmpeg

# Linux (Ubuntu/Debian)
sudo apt install ffmpeg

# Verify installation
ffmpeg -version
```

## Available Scripts

All scripts are in `scripts/`. Run them via bash.

### 1. Video to GIF

Convert a video file to an animated GIF.

```bash
bash scripts/video-to-gif.sh input.mp4 output.gif
```

Options via environment variables:

| Variable   | Default | Description                       |
| ---------- | ------- | --------------------------------- |
| `FPS`      | `15`    | GIF frame rate                    |
| `WIDTH`    | `480`   | Output width (height auto-scales) |
| `START`    | `0`     | Start time (seconds or HH:MM:SS)  |
| `DURATION` | (full)  | Duration to convert (seconds)     |

Example — high-quality GIF from first 5 seconds:

```bash
FPS=20 WIDTH=640 DURATION=5 bash scripts/video-to-gif.sh demo.mp4 demo.gif
```

### 2. Trim Video

Extract a segment from a video.

```bash
bash scripts/trim-video.sh input.mp4 output.mp4 00:00:10 00:00:30
```

Arguments: `<input> <output> <start_time> <end_time>`

Time format: `HH:MM:SS` or seconds (e.g., `10` for 10s).

### 3. Concatenate Videos

Join multiple video files into one.

```bash
bash scripts/concat-clips.sh output.mp4 clip1.mp4 clip2.mp4 clip3.mp4
```

Arguments: `<output> <input1> <input2> [input3...]`

All input files should have the same codec and resolution for best results.

### 4. Extract Audio

Extract audio track from a video.

```bash
bash scripts/extract-audio.sh input.mp4 output.mp3
```

Supports output formats: `.mp3`, `.aac`, `.wav`, `.flac`, `.ogg`

### 5. Extract Frames

Extract individual frames as images.

```bash
bash scripts/extract-frames.sh input.mp4 frames/ 1
```

Arguments: `<input> <output_dir> <fps>`

- `fps=1` extracts 1 frame per second
- `fps=0.1` extracts 1 frame every 10 seconds

### 6. Resize Video

Scale a video to specific dimensions.

```bash
bash scripts/resize-video.sh input.mp4 output.mp4 1280 720
```

Arguments: `<input> <output> <width> <height>`

Use `-1` for width or height to auto-scale maintaining aspect ratio:

```bash
bash scripts/resize-video.sh input.mp4 output.mp4 720 -1
```

## Notes

- All scripts check for ffmpeg availability and exit with a clear error if missing.
- Processing large files can take significant time — use `shell-bg` skill to run in background if needed.
- GIF files can be very large — consider reducing FPS or width for smaller files.
- Lossless operations (trim, concat) use stream copy (`-c copy`) when possible for speed.
