#!/usr/bin/env node
// ============================================================================
// Exports the OverlapX brochure (/deck) to a 16:9 PDF with headless Chrome.
// No dependencies: it shells out to a locally installed Chrome/Chromium.
//
//   pnpm dev:web            # or any running server
//   node scripts/export-deck.mjs [baseUrl]
//
// Writes apps/web/public/overlapx-deck.pdf, which /deck links to and the site
// serves at /overlapx-deck.pdf. Commit the PDF after regenerating it.
// Override the browser with CHROME_PATH if it is not found.
// ============================================================================

import { execFileSync } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "apps/web/public/overlapx-deck.pdf");
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");

const candidates = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);
const chrome = candidates.find((p) => existsSync(p));
if (!chrome) {
  console.error("Chrome not found. Set CHROME_PATH to a Chrome/Chromium binary.");
  process.exit(1);
}

execFileSync(
  chrome,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-pdf-header-footer",
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=8000",
    `--print-to-pdf=${out}`,
    `${base}/deck`,
  ],
  { stdio: "inherit" }
);

console.log(`Wrote ${out} (${Math.round(statSync(out).size / 1024)} KB)`);
