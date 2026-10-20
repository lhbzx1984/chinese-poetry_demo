import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const origin = process.env.BASE_URL || "http://localhost:3000";
const out = process.env.SCREENSHOT_DIR || "docs/screenshots";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const report = { origin, pages: [], errors: [], homeJavaScriptBytes: 0 };
try {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript(() => {
    sessionStorage.setItem("shijing:veil-seen", "1");
    localStorage.setItem("shijing:map-mode", "2d");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => report.errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") report.errors.push(message.text());
  });
  const response = await page.request.get(origin + "/api/poems?limit=1");
  const result = await response.json();
  const id = result.data?.items?.[0]?.id || result.data?.[0]?.id;
  assert.ok(id, "数据库需要至少一首诗供截图使用");
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const [name, path] of [
      ["home", "/"],
      ["library", "/library"],
      ["reader", "/read/" + id],
      ["video", "/video"],
    ]) {
      await page.goto(origin + path, { waitUntil: "networkidle" });
      await page.locator("main").waitFor();
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({
        path: out + "/" + name + "-" + width + ".png",
        fullPage: true,
      });
      const dimensions = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
      }));
      assert.ok(
        dimensions.scroll <= width + 1,
        name + "横向溢出: " + JSON.stringify(dimensions),
      );
      report.pages.push({ name, width, ...dimensions });
      if (name === "home" && width === 1440)
        report.homeJavaScriptBytes = await page.evaluate(() =>
          performance
            .getEntriesByType("resource")
            .filter((r) => r.initiatorType === "script")
            .reduce((sum, r) => sum + r.decodedBodySize, 0),
        );
    }
  }
  await context.close();
} finally {
  await browser.close();
  await writeFile(out + "/results.json", JSON.stringify(report, null, 2));
}
assert.equal(
  report.errors.length,
  0,
  "浏览器错误: " + JSON.stringify(report.errors),
);
console.log(JSON.stringify(report, null, 2));
