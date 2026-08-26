import { chromium } from "playwright-core";
import { pathToFileURL } from "node:url";

const html = "/workspace/.grok/og-card.html";
const out = "/workspace/.grok/og-raw.png";
const exe =
  "/opt/pw-browsers/chromium_headless_shell-1234/chrome-headless-shell-linux64/chrome-headless-shell";

const browser = await chromium.launch({
  executablePath: exe,
  args: ["--no-sandbox", "--disable-gpu", "--font-render-hinting=medium"],
});
const page = await browser.newPage({
  viewport: { width: 1200, height: 630 },
  deviceScaleFactor: 2,
});
await page.goto(pathToFileURL(html).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(120);
await page.screenshot({ path: out, type: "png" });
await browser.close();
console.log("wrote", out);
