import assert from "node:assert/strict";
import { existsSync, lstatSync, readFileSync, readdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { join, resolve, relative, sep } from "node:path";

const root = resolve(process.argv[2] || "");
if (!root || !existsSync(root)) throw new Error("Usage: node verify-drippy-sync-package.mjs <package-root>");

const required = [
  "morph-bot.js",
  "morph-bot.d.ts",
  "grok-bot-engine.js",
  "original-data.js",
  "catalog.js",
  "materials.js",
  "materials.d.ts",
  "runtime/drippy-character.js",
  "runtime/character-interaction.js",
  "runtime/speech-meter.js",
  "runtime/state-behavior-system.js",
  "runtime/svg-renderer.js",
  "runtime/material-system.js",
  "runtime/vendor/animalese-tts/LICENSE",
  "runtime/vendor/pinyin-pro/LICENSE",
  "drippy-idle.png",
];

for (const item of required) {
  const path = join(root, item);
  assert.ok(existsSync(path), `missing release file: ${item}`);
  assert.ok(!lstatSync(path).isSymbolicLink(), `release file must not be a symlink: ${item}`);
}

const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const path = join(dir, entry.name);
  if (entry.isSymbolicLink()) throw new Error(`symlink rejected: ${relative(root, path)}`);
  return entry.isDirectory() ? walk(path) : [path];
});
for (const file of walk(root)) {
  const rel = relative(root, file);
  assert.ok(!rel.startsWith("..") && !rel.includes(`${sep}..${sep}`), `invalid path: ${rel}`);
}

class FakeHTMLElement {
  constructor() {
    this.attributes = new Map();
    this.style = { setProperty() {} };
    this.shadowRoot = null;
  }
  attachShadow() { this.shadowRoot = { querySelector: () => null, innerHTML: "" }; return this.shadowRoot; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  toggleAttribute(name, force) { force ? this.setAttribute(name, "") : this.removeAttribute(name); }
  dispatchEvent() { return true; }
}
globalThis.HTMLElement = FakeHTMLElement;
globalThis.CustomEvent ??= class CustomEvent { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } };

const component = await import(pathToFileURL(join(root, "morph-bot.js")).href + `?verify=${Date.now()}`);
const requiredStates = ["idle", "listening", "thinking", "searching", "working", "drowsy", "happy", "curious", "confused", "dictating", "writing", "sending", "receiving", "uploading", "alerting", "dragging"];
const requiredMorphs = ["radar", "send", "receive", "pencil", "gather", "bang"];
for (const state of requiredStates) assert.ok(component.MORPH_BOT_STATES.includes(state), `required state missing: ${state}`);
for (const morph of requiredMorphs) assert.ok(component.MORPH_BOT_EFFECTS.includes(morph), `required morph missing: ${morph}`);
for (const method of ["setState", "playMorph", "restoreStateMorph", "connectAudio", "disconnectAudio", "setSpeechLevel", "pause", "play"]) {
  assert.equal(typeof component.MorphBotElement.prototype[method], "function", `required method missing: ${method}`);
}
for (const attr of ["state", "shape", "halo", "interactive", "follow-pointer"]) {
  assert.ok(component.MorphBotElement.observedAttributes.includes(attr), `required observed attribute missing: ${attr}`);
}

const source = readFileSync(join(root, "morph-bot.js"), "utf8");
assert.doesNotMatch(source, /from\s+["']\.\.\//, "release must not import outside its own directory");
assert.ok(lstatSync(join(root, "drippy-idle.png")).size > 1000, "snapshot looks invalid");
console.log(`Drippy sync package OK: ${component.MORPH_BOT_STATES.length} states, ${component.MORPH_BOT_EFFECTS.length} morphs.`);
