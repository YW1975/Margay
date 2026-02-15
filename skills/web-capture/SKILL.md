---
name: web-capture
description: Capture screenshots of web pages using Puppeteer. Supports full-page, viewport, and element-specific captures with configurable dimensions. Use when user asks to screenshot a website, capture a page, or generate a visual preview of a URL.
dependencies:
  - type: npm
    name: tsx
    install: 'npm install -g tsx'
  - type: npm
    name: puppeteer
    install: 'npm install -g puppeteer'
---

# Web Capture Skill

Take screenshots of web pages using headless Chromium (Puppeteer).

## Prerequisites

Install Puppeteer if not already installed:

```bash
npm install -g puppeteer
# or in the workspace:
npm install puppeteer
```

Puppeteer will download a bundled Chromium. If you already have Chrome/Chromium, you can skip the download by setting:

```bash
PUPPETEER_SKIP_DOWNLOAD=true
```

And pass the browser path via `--browser-path`.

## Usage

All commands use the capture script at `scripts/capture.ts`.

### Full-page screenshot

```bash
npx tsx scripts/capture.ts --url "https://example.com" --output screenshot.png
```

### Viewport-only screenshot (no scroll)

```bash
npx tsx scripts/capture.ts --url "https://example.com" --output viewport.png --no-full-page
```

### Custom viewport dimensions

```bash
npx tsx scripts/capture.ts --url "https://example.com" --output wide.png --width 1920 --height 1080
```

### Capture a specific CSS selector

```bash
npx tsx scripts/capture.ts --url "https://example.com" --output element.png --selector ".main-content"
```

### Wait for page to settle

```bash
npx tsx scripts/capture.ts --url "https://example.com" --output loaded.png --wait 3000
```

### PDF output

```bash
npx tsx scripts/capture.ts --url "https://example.com" --output page.pdf --pdf
```

### Use existing Chrome/Chromium

```bash
npx tsx scripts/capture.ts --url "https://example.com" --output out.png --browser-path "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
```

## Options

| Flag                             | Default       | Description                              |
| -------------------------------- | ------------- | ---------------------------------------- |
| `--url`                          | (required)    | URL to capture                           |
| `--output`                       | `capture.png` | Output file path (.png or .pdf)          |
| `--width`                        | `1280`        | Viewport width in pixels                 |
| `--height`                       | `800`         | Viewport height in pixels                |
| `--full-page` / `--no-full-page` | `true`        | Capture full scrollable page             |
| `--selector`                     | (none)        | CSS selector to capture specific element |
| `--wait`                         | `0`           | Extra wait time in ms after page load    |
| `--pdf`                          | `false`       | Output as PDF instead of PNG             |
| `--browser-path`                 | (auto)        | Path to Chrome/Chromium executable       |
| `--dark-mode`                    | `false`       | Emulate dark color scheme                |
| `--device-scale`                 | `1`           | Device scale factor (2 for retina)       |

## Examples

**Screenshot a GitHub repo page:**

```bash
npx tsx scripts/capture.ts --url "https://github.com/user/repo" --output repo.png --width 1440
```

**Capture a chart element:**

```bash
npx tsx scripts/capture.ts --url "https://dashboard.example.com" --output chart.png --selector "#revenue-chart" --wait 2000
```

**Generate PDF of documentation:**

```bash
npx tsx scripts/capture.ts --url "https://docs.example.com/guide" --output guide.pdf --pdf
```

## Notes

- The script runs headless by default (no visible browser window).
- For pages with lazy-loaded content, use `--wait` to allow content to render.
- Large full-page screenshots may use significant memory.
- Some sites block headless browsers — the script sets a realistic User-Agent to reduce detection.
