import { chromium } from "playwright";

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text()); });

await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle" });
await page.waitForTimeout(400);
const warn = page.getByRole("button", { name: "বুঝেছি, পড়ব" });
if (await warn.count()) await warn.click();
await page.waitForTimeout(250);
await page.screenshot({ path: "/workspace/screenshots/cover-open.png" });

await page.goto("http://127.0.0.1:8080/read/04", { waitUntil: "networkidle" });
await page.waitForTimeout(700);
await page.screenshot({ path: "/workspace/screenshots/read-04-hidden.png" });

const tocCount = await page.locator("aside nav a").count();
console.log("desktop sidebar links", tocCount);

await page.getByRole("button", { name: "সব দেখান" }).click();
await page.waitForTimeout(300);
await page.mouse.wheel(0, 1100);
await page.waitForTimeout(250);
await page.screenshot({ path: "/workspace/screenshots/read-04-red-scroll.png" });

await page.getByRole("button", { name: "হাতের খাতা" }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: "/workspace/screenshots/theme-manuscript.png" });

await page.getByRole("button", { name: "কফি হাউস" }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: "/workspace/screenshots/theme-cafe.png" });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
mobile.on("pageerror", (e) => console.log("MOBILE PAGEERROR", e.message));
await mobile.goto("http://127.0.0.1:8080/read/05", { waitUntil: "networkidle" });
await mobile.waitForTimeout(700);
const mwarn = mobile.getByRole("button", { name: "বুঝেছি, পড়ব" });
if (await mwarn.count()) await mwarn.click();
await mobile.waitForTimeout(250);
await mobile.screenshot({ path: "/workspace/screenshots/mobile-read-05.png" });

await mobile.getByRole("button", { name: "সূচিপত্র" }).click();
await mobile.waitForTimeout(350);
await mobile.screenshot({ path: "/workspace/screenshots/mobile-toc.png" });
await mobile.getByRole("button", { name: "সূচি বন্ধ করুন" }).click();
await mobile.waitForTimeout(200);

await mobile.getByRole("button", { name: "সব দেখান" }).click();
await mobile.waitForTimeout(300);
await mobile.mouse.wheel(0, 500);
await mobile.waitForTimeout(250);
await mobile.screenshot({ path: "/workspace/screenshots/mobile-read-05-red.png" });

const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
console.log("mobile overflow", overflow);

await browser.close();
console.log("QA done");
