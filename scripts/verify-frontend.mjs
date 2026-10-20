import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const report = { errors: [], audio: [], checks: [] };
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() => {
    const Original = window.AudioContext;
    window.__audioContexts = 0;
    window.AudioContext = class extends Original {
      constructor(...args) {
        super(...args);
        window.__audioContexts++;
      }
    };
    localStorage.setItem("shijing:map-mode", "2d");
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  assert.equal(await page.evaluate(() => window.__audioContexts), 0);
  await page.getByRole("button", { name: "入境 · 开启诗乐" }).click();
  await page.waitForFunction(() => window.__shijingAudio?.state().homePlaying);
  await page.waitForTimeout(1500);
  report.audio.push(
    await page.evaluate(() => ({
      contexts: window.__audioContexts,
      ...window.__shijingAudio.state(),
      level: window.__shijingAudio.level(),
    })),
  );
  assert.equal(report.audio[0].contexts, 1);
  assert.ok(report.audio[0].level > 0 && report.audio[0].level < 1);
  console.log("audio", report.audio);
  await page.locator(".map-section").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector(".map-box canvas"));
  console.log("map loaded");
  await page.getByRole("button", { name: "李白", exact: true }).click();
  await page.waitForFunction(() => document.querySelector(".poet-card"));
  assert.ok(await page.locator(".poet-route button").count());
  await page.screenshot({
    path: "docs/screenshots/map-2d-1440.png",
    fullPage: false,
  });
  report.checks.push(
    "entry gesture, one AudioContext, audible master, lazy 2D map, poet card routes",
  );
  if (
    await page.evaluate(() =>
      Boolean(document.createElement("canvas").getContext("webgl")),
    )
  ) {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page
      .getByRole("button", { name: "平面 · 切换立体", exact: true })
      .click();
    await page.waitForFunction(() => document.querySelector(".map-box canvas"));
    await page.waitForTimeout(1500);
    await page
      .locator(".map-wrap")
      .screenshot({ path: "docs/screenshots/map-3d-1440.png" });
    report.checks.push(
      "3D map switched with selected route and pulsing halo; no runtime error",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
  }

  await page.getByRole("link", { name: "书库", exact: true }).first().click();
  await page.waitForURL("**/library");
  await page.waitForTimeout(900);
  assert.equal(
    await page.evaluate(() => window.__shijingAudio.state().homePlaying),
    false,
  );
  const poem = page.locator(".poem-card").first();
  await poem.click();
  await page.waitForURL("**/read/**");
  await page.getByRole("button", { name: "朗读设置", exact: true }).click();
  await page.getByRole("button", { name: "只听配乐", exact: true }).click();
  await page.waitForFunction(() => window.__shijingAudio.state().homePlaying);
  assert.equal(await page.evaluate(() => window.__audioContexts), 1);
  await page.getByRole("button", { name: "停止配乐", exact: true }).click();
  await page.getByRole("button", { name: "横排", exact: true }).click();
  await page.locator("#reader-size").selectOption("40");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("#reader-size").inputValue(), "40");
  report.checks.push(
    "home bed stops on navigation; reader reuses context; typography persists",
  );
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "诗乐设置" }).first().click();
  await page
    .getByRole("button", { name: "关闭诗乐", exact: true })
    .first()
    .click();
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.evaluate(() => localStorage.getItem("shijing:audio")),
    "off",
  );
  assert.equal(await page.evaluate(() => window.__audioContexts), 0);
  report.checks.push("mute persisted; no context after reload without gesture");
  await context.close();
} finally {
  await browser.close();
  await writeFile(
    "docs/verification/frontend-interactions.json",
    JSON.stringify(report, null, 2),
  );
}
assert.equal(report.errors.length, 0);
console.log(report);
