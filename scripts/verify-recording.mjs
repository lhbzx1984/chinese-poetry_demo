import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const report = { errors: [], bytes: 0, audioRms: 0, cancelled: false };
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  await context.addInitScript(() =>
    sessionStorage.setItem("shijing:veil-seen", "1"),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  const raw = await (
    await page.request.get("http://localhost:3000/api/poems?limit=1")
  ).json();
  const poem = await (
    await page.request.get(
      "http://localhost:3000/api/poems/" + raw.data.items[0].id,
    )
  ).json();
  const p = poem.data;
  const scene = {
    index: 0,
    lines: ["明月照山河。"],
    text: "明月照山河。",
    imagery: [],
    translation: null,
    note: null,
  };
  const image =
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#1d2e2c"/></svg>',
    );
  await page.route("**/api/poems/*/experience", (r) =>
    r.fulfill({
      json: {
        data: {
          poem: p,
          visualBible: {
            era: "唐",
            mood: "山水清音",
            palette: { zh: "墨绿", css: ["#1d2e2c", "#070d0f", "#e3c76e"] },
            imagerySummary: "山河",
          },
          scenes: [scene],
          images: [{ index: 0, status: "ready", url: image }],
          mode: "ai",
          aiProgress: { done: 1, total: 1 },
          imagesCached: true,
          analysisDone: true,
        },
        settled: true,
      },
    }),
  );
  const samples = 24000,
    wav = Buffer.alloc(44 + samples * 2);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++)
    wav.writeInt16LE(
      Math.round(
        Math.sin((i * 2 * Math.PI * 440) / 24000) *
          4000 *
          Math.sin((Math.PI * i) / samples),
      ),
      44 + i * 2,
    );
  await page.route("**/api/tts", (r) =>
    r.fulfill({ contentType: "audio/wav", body: wav }),
  );
  let uploaded;
  await page.route("**/api/videos?*", async (r) => {
    uploaded = r.request().postDataBuffer();
    await r.fulfill({ json: { data: { id: "test-recording" } } });
  });
  await page.goto("http://localhost:3000/read/" + p.id, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "生成短片", exact: true }).click();
  await page.waitForURL("**/video", { timeout: 20000 });
  assert.ok(uploaded?.length > 1000);
  report.bytes = uploaded.length;
  report.audioRms = await page.evaluate(async (bytes) => {
    const ctx = window.__shijingMusic.context();
    const buffer = await ctx.decodeAudioData(Uint8Array.from(bytes).buffer);
    const a = buffer.getChannelData(0);
    return Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
  }, Array.from(uploaded));
  assert.ok(report.audioRms > 0.001);
  await page.route("**/api/videos", (r) =>
    r.fulfill({
      json: {
        data: [
          {
            id: "test-recording",
            title: "录制验证",
            author: "测试",
            duration: 5,
            bytes: uploaded.length,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    }),
  );
  await page.route("**/api/videos/test-recording", (r) =>
    r.request().method() === "DELETE"
      ? r.fulfill({ json: { ok: true } })
      : r.fulfill({ contentType: "video/webm", body: uploaded }),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".video-card").first().click();
  await page.getByRole("button", { name: "删除影片", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  await page.getByRole("button", { name: "删除影片", exact: true }).click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  report.deleteModal = true;
  await page.goto("http://localhost:3000/read/" + p.id, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "生成短片", exact: true }).click();
  await page
    .getByRole("button", { name: "录制画面与混音…", exact: true })
    .waitFor();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page
    .getByText("录制已取消：请保持页面在前台后重新生成短片。", { exact: true })
    .waitFor();
  report.cancelled = true;
  assert.equal(report.errors.length, 0);
} finally {
  await browser.close();
  await writeFile(
    "docs/verification/frontend-recording.json",
    JSON.stringify(report, null, 2),
  );
}
console.log(report);
