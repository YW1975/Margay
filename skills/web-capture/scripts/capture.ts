#!/usr/bin/env npx tsx
/**
 * Web page screenshot capture using Puppeteer.
 *
 * Usage:
 *   npx tsx capture.ts --url "https://example.com" --output screenshot.png
 *   npx tsx capture.ts --url "https://example.com" --output page.pdf --pdf
 *   npx tsx capture.ts --url "https://example.com" --selector ".content" --output element.png
 */

import { parseArgs } from 'node:util';
import path from 'node:path';

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    output: { type: 'string', default: 'capture.png' },
    width: { type: 'string', default: '1280' },
    height: { type: 'string', default: '800' },
    'full-page': { type: 'boolean', default: true },
    'no-full-page': { type: 'boolean', default: false },
    selector: { type: 'string' },
    wait: { type: 'string', default: '0' },
    pdf: { type: 'boolean', default: false },
    'browser-path': { type: 'string' },
    'dark-mode': { type: 'boolean', default: false },
    'device-scale': { type: 'string', default: '1' },
  },
  strict: true,
});

if (!values.url) {
  console.error('Error: --url is required');
  console.error('Usage: npx tsx capture.ts --url "https://example.com" --output screenshot.png');
  process.exit(1);
}

const url = values.url;
const output = values.output!;
const width = parseInt(values.width!, 10);
const height = parseInt(values.height!, 10);
const fullPage = values['full-page'] && !values['no-full-page'];
const selector = values.selector;
const waitMs = parseInt(values.wait!, 10);
const isPdf = values.pdf || output.endsWith('.pdf');
const browserPath = values['browser-path'];
const darkMode = values['dark-mode'];
const deviceScale = parseFloat(values['device-scale']!);

async function main() {
  // Dynamic import with auto-install (like mermaid skill pattern)
  let puppeteer: typeof import('puppeteer');
  try {
    puppeteer = await import('puppeteer');
  } catch {
    console.error('Installing puppeteer (first run)...');
    const { execSync } = await import('node:child_process');
    try {
      execSync('npm install puppeteer', { stdio: 'inherit', cwd: import.meta.dirname });
      puppeteer = await import('puppeteer');
    } catch (installErr) {
      console.error('Error: Failed to install puppeteer.');
      console.error('Install manually with: npm install -g puppeteer');
      process.exit(1);
    }
  }

  const launchOptions: import('puppeteer').PuppeteerLaunchOptions = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  };
  if (browserPath) {
    launchOptions.executablePath = browserPath;
  }

  const browser = await puppeteer.default.launch(launchOptions);

  try {
    const page = await browser.newPage();

    await page.setViewport({
      width,
      height,
      deviceScaleFactor: deviceScale,
    });

    if (darkMode) {
      await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
    }

    // Set a realistic User-Agent to reduce headless detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    console.log(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });

    if (waitMs > 0) {
      console.log(`Waiting ${waitMs}ms for content to settle...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }

    const outputPath = path.resolve(output);

    if (isPdf) {
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' },
      });
      console.log(`PDF saved: ${outputPath}`);
    } else if (selector) {
      const element = await page.$(selector);
      if (!element) {
        console.error(`Error: selector "${selector}" not found on page`);
        process.exit(1);
      }
      await element.screenshot({ path: outputPath });
      console.log(`Element screenshot saved: ${outputPath}`);
    } else {
      await page.screenshot({ path: outputPath, fullPage });
      console.log(`Screenshot saved: ${outputPath} (fullPage=${fullPage})`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Capture failed:', error.message);
  process.exit(1);
});
