// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/verify-drippy-browser.mjs
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const base = process.env.STUDIO_URL || "http://127.0.0.1:4174";
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["/", "/component/", "/aurora-orb/"]) {
      const response = await page.goto(base + route);
      assert.equal(response.status(), 200);
      await page.waitForTimeout(300);
    }
  }
  await page.goto(base + "/component/");
  await page.evaluate(async () => {
    await customElements.whenDefined("morph-bot");
    document.body.innerHTML = '<morph-bot id="test" interactive size="280" state="thinking"></morph-bot>';
    window.bot = document.querySelector("#test");
    await new Promise(resolve => bot.addEventListener("ready", resolve, { once: true }));
  });
  await page.waitForTimeout(500);
  const result = await page.evaluate(async () => {
    const bot = window.bot;
    const { MORPH_BOT_EFFECTS } = await import("/component/morph-bot.js");
    const e = bot._engine;
    bot.pause();
    const step = (n = 50) => { for (let i = 0; i < n; i++) { e.pendingStep = 1 / 60; e.frame(performance.now()); cancelAnimationFrame(e.frameId); } };
    for (const effect of MORPH_BOT_EFFECTS) {
      e.morphPreview = { effect, startedAt: e.clockTime, hold: 100, restore: "none" };
      // Use public playback so timing and interruptions match the editor.
      bot.playMorph(effect, { hold: 100 }); step(80);
    }
    e.morphPreview = null;
    bot.state = "idle"; step(180);
    const visibleLayers = [...e.morphLayers.values()].filter(l => getComputedStyle(l.group).display !== "none").length;
    const hiddenParts = [...bot.shadowRoot.querySelectorAll('[hidden]')].every(node => getComputedStyle(node).display === "none");
    bot.play(); bot.setSpeechLevel(0.8); step(40);
    const speaking = e.drippyMouthOpen.getAttribute("ry");
    bot.setSpeechLevel(0); step(70);
    const silence = e.drippyMouthOpen.style.opacity;
    let rejected = false; try { bot.setSpeechLevel(NaN); } catch { rejected = true; }
    return { visibleLayers, hiddenParts, speaking: Number(speaking), silence: Number(silence), rejected };
  });
  assert.equal(result.visibleLayers, 0);
  assert.equal(result.hiddenParts, true);
  assert.ok(result.speaking > 5);
  assert.ok(result.silence < 0.02);
  assert.ok(result.rejected);
  for (const material of ["solid", "gradient", "rainbow-glass"]) {
    await page.evaluate(material => window.bot.setAttribute("material", material), material);
    await page.waitForTimeout(100);
  }
  const svg = page.locator("morph-bot svg");
  const box = await svg.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 20);
  await page.mouse.up(); await page.waitForTimeout(700);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => window.bot.state = "happy");
  await page.waitForTimeout(100);
  await svg.screenshot({ path: "/tmp/drippy-premium-preview.png" });
  assert.deepEqual(errors, []);
  console.log("Drippy browser: routes desktop/mobile, morph visibility, speech/silence, materials, pointer release and reduced motion passed.");
} finally { await browser.close(); }
