// PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs STUDIO_URL=http://127.0.0.1:4175 node scripts/verify-subtle-expressions.mjs
import assert from "node:assert/strict";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 780 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const fixture = `${process.env.STUDIO_URL || "http://127.0.0.1:4175"}/__drippy-test`;
  await page.route(fixture, route => route.fulfill({ contentType: "text/html", body: "<!doctype html><html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head><body></body></html>" }));
  await page.goto(fixture);
  await page.evaluate(async () => {
    const { MORPH_BOT_STATES } = await import("/component/morph-bot.js");
    document.body.innerHTML = '<morph-bot size="72" paused></morph-bot>';
    window.states = MORPH_BOT_STATES;
    window.step = (bot, frames) => {
      const engine = bot._engine;
      for (let i = 0; i < frames; i++) {
        engine.pendingStep = 1 / 60;
        engine.frame(performance.now());
        cancelAnimationFrame(engine.frameId);
      }
    };
  });
  await page.waitForFunction(() => document.querySelector("morph-bot")?._engine);
  const checks = await page.evaluate(() => {
    const bot = document.querySelector("morph-bot");
    const engine = bot._engine;
    const invalid = [];
    for (const state of window.states) {
      bot.state = state; step(bot, 80);
      for (const node of bot.shadowRoot.querySelectorAll("path, ellipse, g")) {
        if ([...node.attributes].some(attribute => /NaN|Infinity/.test(attribute.value))) invalid.push(state);
      }
    }
    bot.state = "surprised"; step(bot, 80);
    const mouth = engine.drippyMouthOpen.style.opacity;
    const line = engine.drippyMouth.style.opacity;
    engine.setPaused(true);
    const before = bot.shadowRoot.querySelector("svg").innerHTML;
    engine.frame(performance.now()); cancelAnimationFrame(engine.frameId);
    const paused = before === bot.shadowRoot.querySelector("svg").innerHTML;
    const poses = [];
    for (const state of ["idle", "shy", "proud", "laughing"]) {
      bot.state = state; step(bot, 100);
      poses.push(engine.drippyMouth.getAttribute("d"));
    }
    return { invalid, paused, mouth: Number(mouth), line: Number(line), distinct: new Set(poses).size };
  });
  assert.deepEqual(checks.invalid, []);
  assert.equal(checks.paused, true, "pausing preserves the emotional pose");
  assert.equal(checks.mouth, 1);
  assert.equal(checks.line, 0, "surprise has no ghost smile behind the O");
  assert.equal(checks.distinct, 4);
  await page.evaluate(() => {
    document.body.innerHTML = "";
    document.body.style = "margin:0;background:#faf9f7;display:grid;grid-template-columns:repeat(4,1fr);font:14px system-ui;text-align:center;gap:12px;padding:15px";
    for (const state of ["idle", "happy", "curious", "confused", "listening", "thinking", "shy", "proud", "sad", "angry", "surprised", "laughing"]) {
      const card = document.createElement("div");
      card.innerHTML = `<morph-bot state="${state}" size="190" paused></morph-bot><div>${state}</div>`;
      document.body.append(card);
    }
  });
  await page.waitForTimeout(100);
  await page.evaluate(() => {
    for (const bot of document.querySelectorAll("morph-bot")) {
      const e = bot._engine;
      e.blinkNext = e.winkNext = e.ambientNext = Infinity;
      step(bot, 120);
    }
  });
  await page.screenshot({ path: "/tmp/drippy-subtle-rest.png" });
  await page.evaluate(() => {
    for (const bot of document.querySelectorAll("morph-bot")) { bot._engine.reactionAt = bot._engine.clockTime; step(bot, 20); }
  });
  await page.screenshot({ path: "/tmp/drippy-subtle-reaction.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const reduced = await page.evaluate(() => {
    const bot = document.querySelector("morph-bot[state=happy]");
    step(bot, 240); // Allow the existing body/eye springs to settle after switching preferences.
    const snapshot = () => [...bot._engine.dotEyes, ...bot._engine.drippyEars, bot._engine.drippyMouth, bot._engine.haloGradient].map(n => n.outerHTML).join("");
    const before = snapshot(); step(bot, 90); return before === snapshot();
  });
  assert.ok(reduced, "reduced motion has no decorative oscillation");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  for (const width of [1100, 390]) {
    await page.setViewportSize({ width, height: 780 });
    for (const material of ["solid", "gradient", "rainbow-glass"]) {
      await page.evaluate(material => {
        document.body.style.gridTemplateColumns = innerWidth < 500 ? "1fr" : "repeat(3,1fr)";
        [...document.querySelectorAll("morph-bot")].forEach((bot, i) => {
          bot.size = [34, 72, 280][i % 3]; bot.setAttribute("material", material); step(bot, 2);
        });
      }, material);
      await page.screenshot({ path: `/tmp/drippy-subtle-${width}-${material}.png`, fullPage: true });
    }
  }
  assert.deepEqual(errors, []);
  console.log("Subtle Drippy browser: 39 states, distinct expressions, pause, reduced motion, desktop/mobile and 34/72/280px across 3 materials passed.");
} finally { await browser.close(); }
