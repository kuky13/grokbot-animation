import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

class FakeHTMLElement {
  constructor() {
    this.attributes = new Map();
    this.style = { values: new Map(), setProperty: (name, value) => this.style.values.set(name, value) };
    this.shadowRoot = null;
  }
  attachShadow() { this.shadowRoot = { querySelector: () => null, innerHTML: "" }; return this.shadowRoot; }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  hasAttribute(name) { return this.attributes.has(name); }
  setAttribute(name, value) {
    const oldValue = this.getAttribute(name);
    this.attributes.set(name, String(value));
    if (this.constructor.observedAttributes?.includes(name)) this.attributeChangedCallback(name, oldValue, String(value));
  }
  removeAttribute(name) {
    const oldValue = this.getAttribute(name);
    this.attributes.delete(name);
    if (oldValue !== null && this.constructor.observedAttributes?.includes(name)) this.attributeChangedCallback(name, oldValue, null);
  }
  toggleAttribute(name, force) { force ? this.setAttribute(name, "") : this.removeAttribute(name); }
  dispatchEvent() { return true; }
}

globalThis.HTMLElement = FakeHTMLElement;
globalThis.CustomEvent ??= class CustomEvent {
  constructor(type, options = {}) {
    this.type = type;
    this.detail = options.detail;
  }
};

const packageRoot = resolve("component");
const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
const component = await import("../component/morph-bot.js");
const downloadPath = resolve(packageRoot, `downloads/morph-bot-element-${manifest.version}.zip`);

assert.equal(manifest.name, "morph-bot-element");
assert.equal(manifest.version, "0.6.0");
assert.equal(manifest.types, "./morph-bot.d.ts");
for (const file of manifest.files) assert.ok(existsSync(resolve(packageRoot, file)), `package file should exist: ${file}`);

assert.equal(component.MORPH_BOT_STATES.length, 39, "component should expose all source states");
assert.equal(component.MORPH_BOT_SHAPES.length, 18, "component should expose all source shapes");
assert.equal(component.MORPH_BOT_EFFECTS.length, 14, "component should expose all morph effects");
assert.equal(component.MORPH_BOT_MATERIALS.length, 3, "component should expose all material modes");
assert.equal(component.MORPH_BOT_SOLID_PRESETS.length, 8, "component should expose all solid presets");
assert.equal(component.MORPH_BOT_GRADIENT_PRESETS.length, 12, "component should expose all linear and soft multi-spot gradient presets");
assert.equal(component.MORPH_BOT_GLASS_PRESETS.length, 5, "component should expose all glass presets");
assert.equal(component.MORPH_BOT_DIALOGUE_VOICES.length, 4, "component should expose all local dialogue voices");
assert.equal(component.MORPH_BOT_DIALOGUE_VOICES[0].id, "playful", "playful gibberish should be the default editor voice");
assert.deepEqual(component.MORPH_BOT_DIALOGUE_ENGLISH_MODES, ["phonetic", "letters"], "component should expose both English rhythm modes");
assert.ok(component.MorphBotElement.observedAttributes.includes("state"));
assert.ok(component.MorphBotElement.observedAttributes.includes("shape"));
assert.equal(typeof component.MorphBotElement.prototype.configure, "function");
assert.equal(typeof component.MorphBotElement.prototype.playMorph, "function");
assert.equal(typeof component.MorphBotElement.prototype.playSequence, "function");
assert.equal(typeof component.MorphBotElement.prototype.stopSequence, "function");
assert.equal(typeof component.MorphBotElement.prototype.performDialogue, "function");
assert.equal(typeof component.MorphBotElement.prototype.pauseDialogue, "function");
assert.equal(typeof component.MorphBotElement.prototype.resumeDialogue, "function");
assert.equal(typeof component.MorphBotElement.prototype.stopDialogue, "function");
assert.equal(typeof component.MorphBotElement.prototype.setMaterial, "function");
assert.equal(typeof component.MorphBotElement.prototype.snapshot, "function");
assert.equal(typeof component.analyzeSpeechUnits, "function", "component should expose its local Mandarin analyzer");
assert.deepEqual(component.analyzeSpeechUnits("重庆").map(({ phonetic }) => phonetic), ["chong", "qing"]);

const element = new component.MorphBotElement();
element.state = "thinking";
element.shape = "hex";
element.size = 72;
element.speed = 0.5;
element.rotation = -12;
assert.equal(element.state, "thinking");
assert.equal(element.shape, "hex");
assert.equal(element.size, 72);
assert.equal(element.speed, 0.5);
assert.equal(element.rotation, -12);
assert.equal(element._engineConfig().headRotation, -12);
assert.equal(element.style.values.get("--morph-bot-size"), "72px");
element.setState("loading").setShape("wedge").pause();
assert.equal(element.state, "loading");
assert.equal(element.shape, "wedge");
assert.equal(element.paused, true);
element.play();
assert.equal(element.paused, false);
element.setMaterial("gradient", { preset: "ocean-signal" });
assert.equal(element.material, "gradient");
assert.equal(element.gradientPreset, "ocean-signal");
const softGradientElement = new component.MorphBotElement();
softGradientElement.setMaterial("gradient", { preset: "porcelain-bloom" });
assert.equal(softGradientElement._engineConfig().eyeColor, "#17203c", "soft light presets should provide a readable default eye color");
element.setMaterial("gradient", { start: "#123456", end: "#abcdef", angle: 42 });
assert.equal(element.gradientPreset, "custom");
assert.equal(element._engineConfig().gradientAngle, 42);
element.setMaterial("rainbow-glass", { preset: "aurora" });
assert.equal(element.glassPreset, "aurora");
element.setAttribute("thumbnail", "");
assert.equal(element._engineConfig().particlesEnabled, false, "catalog thumbnails should disable particle emission");
element.removeAttribute("thumbnail");
assert.equal(element._engineConfig().particlesEnabled, true, "normal component instances should keep full particle effects");
assert.throws(() => element.setState("missing"), RangeError);
assert.throws(() => element.setShape("missing"), RangeError);
assert.throws(() => element.setMaterial("missing"), RangeError);
await assert.rejects(element.playSequence([]), TypeError);

const sequenceCalls = [];
element._engine = { clearMorphPreview() {} };
element.setState = (state) => { sequenceCalls.push(`state:${state}`); return element; };
element.playMorph = async (effect, options) => { sequenceCalls.push(`morph:${effect}:${options.hold}`); return { cancelled: false }; };
element.dispatchEvent = (event) => { sequenceCalls.push(`event:${event.type}`); return true; };
const sequenceResult = await element.playSequence([
  { state: "idle", hold: 0, morph: "gather", morphHold: 700 },
  { state: "thinking", hold: 0 },
]);
assert.equal(sequenceResult.cancelled, false);
assert.equal(sequenceResult.cycles, 1);
assert.deepEqual(sequenceCalls, [
  "event:sequencestart",
  "state:idle",
  "event:sequencestep",
  "morph:gather:700",
  "state:thinking",
  "event:sequencestep",
  "event:sequenceend",
]);

const source = readFileSync(resolve(packageRoot, "morph-bot.js"), "utf8");
assert.doesNotMatch(source, /from\s+["']\.\.\//, "published component must not import outside its package");
assert.ok(existsSync(resolve(packageRoot, "runtime/vendor/pinyin-pro/LICENSE")), "vendored Mandarin analyzer should retain its MIT license");
assert.ok(existsSync(resolve(packageRoot, "runtime/vendor/animalese-tts/LICENSE")), "vendored animalese-tts runtime should retain its MIT license");
assert.ok(existsSync(resolve(packageRoot, "runtime/vendor/animalese-tts/english-sprite.wav")), "sampled dialogue should ship its local voice Sprite");

const demo = readFileSync(resolve(packageRoot, "index.html"), "utf8");
const demoRuntime = readFileSync(resolve(packageRoot, "demo.js"), "utf8");
const dialogueEditorRuntime = readFileSync(resolve(packageRoot, "dialogue-editor.js"), "utf8");
const dialogueRuntime = readFileSync(resolve(packageRoot, "runtime/dialogue-director.js"), "utf8");
const animaleseRuntime = readFileSync(resolve(packageRoot, "runtime/chinese-animalese.js"), "utf8");
const audioTimelineRuntime = readFileSync(resolve(packageRoot, "runtime/dialogue-audio-timeline.js"), "utf8");
const docs = readFileSync(resolve(packageRoot, "docs/index.html"), "utf8");
const docsRuntime = readFileSync(resolve(packageRoot, "docs/docs.js"), "utf8");
const localServer = readFileSync(resolve("server.mjs"), "utf8");
assert.match(localServer, /"\.mjs":\s*"text\/javascript; charset=utf-8"/, "local preview server must serve vendored ESM with a JavaScript MIME type");
assert.match(localServer, /"\.wav":\s*"audio\/wav"/, "local preview server must serve the Animalese Sprite as audio");
for (const section of ['id="edit"', 'id="display"', 'id="use"']) assert.ok(demo.includes(section), `component guide should include ${section}`);
assert.ok(demo.includes('id="preview-stage"'), "component workbench should expose a live preview stage above the fold");
assert.ok(demo.includes('id="component-code"'), "component workbench should expose synchronized generated code");
assert.ok(demo.includes('id="state-grid"'), "component workbench should expose the complete visual state catalog");
assert.ok(demo.includes('id="shape-grid"'), "component workbench should expose the complete visual shape catalog");
assert.ok(demo.includes('id="material-tabs"') && demo.includes('id="material-presets"'), "component workbench should expose the complete material editor");
assert.ok(demo.includes('id="sequence-list"'), "component workbench should expose a visual sequence timeline");
assert.ok(demo.includes('id="add-sequence-step"'), "component workbench should allow adding timeline steps");
assert.ok(demo.includes('id="sequence-loop"'), "component workbench should expose timeline looping");
assert.ok(demo.includes('id="preview-sequence"') && demo.includes('id="stop-sequence"'), "component workbench should expose timeline playback controls");
assert.ok(demo.includes('id="dialogue-editor"') && demo.includes('id="dialogue-action-menu"'), "component workbench should expose the inline dialogue director");
assert.ok(demo.includes('id="dialogue-auto-action"') && demo.includes('id="dialogue-undo-auto"'), "dialogue workbench should expose automatic direction with an explicit undo");
assert.match(dialogueEditorRuntime, /planDialogueActions/, "dialogue editor should generate text-aware randomized actions");
assert.ok(demo.includes('data-preview-mode="dialogue"'), "component workbench should make dialogue mode directly selectable");
assert.ok(demo.includes('id="dialogue-english-mode"'), "dialogue workbench should expose mixed-language English routing");
assert.doesNotMatch(demo, /常用状态|常用形状/, "component workbench must not hide choices behind a common subset");
assert.match(demoRuntime, /STATE_IDS as orderedStates/, "the visual state options should use the idle-first shared catalog");
assert.match(demoRuntime, /botThumbnail\(\{ state, shape/, "state and shape catalogs should render real component thumbnails");
assert.match(demoRuntime, /setAttribute\("thumbnail"/, "catalog previews should suppress incidental particle trails");
assert.doesNotMatch(demoRuntime, /preview\.shape = shapeInput|preview\.state = stateInput/, "catalog previews must not trigger bulk shape or state transitions");
assert.match(demoRuntime, /const sequence = \[/, "workbench should keep an editable sequence model");
assert.match(demoRuntime, /data-step-hold/, "timeline steps should expose state hold duration");
assert.match(demoRuntime, /data-morph-option/, "timeline should expose a visible morph picker");
assert.match(demoRuntime, /\[null, \.\.\.MORPH_BOT_EFFECTS\]/, "timeline should list every morph effect plus no-effect");
assert.match(demoRuntime, /bot\.playSequence\(/, "timeline preview should use the public sequence API");
assert.match(demoRuntime, /state-role-markers/, "state catalog should show timeline step markers");
assert.match(demoRuntime, /bot\.stopSequence\(/, "timeline preview should be cancellable");
assert.match(demoRuntime, /setupDialogueWorkbench/, "workbench should initialize the @ action editor");
assert.match(dialogueEditorRuntime, /\.\.\.orderedStates\.map/, "@ menu should include all 39 idle-first states");
assert.match(dialogueEditorRuntime, /\.\.\.MORPH_BOT_EFFECTS\.map/, "@ menu should include all 14 Morph effects");
assert.match(dialogueEditorRuntime, /match\(\/@\(/, "dialogue editor should open its action menu from an inline @ query");
assert.match(dialogueEditorRuntime, /ArrowDown|ArrowUp/, "@ menu should support keyboard navigation");
assert.match(dialogueEditorRuntime, /englishModeSelect/, "dialogue editor should pass the selected English rhythm mode to playback");
assert.match(animaleseRuntime, /playScheduled/, "sampled dialogue should schedule phrases against AudioContext time");
assert.match(animaleseRuntime, /getOutputTimestamp/, "sampled dialogue should use the browser audio output clock when available");
assert.match(animaleseRuntime, /outputLatency/, "sampled dialogue should compensate device output latency");
assert.match(dialogueRuntime, /_followSpeechClock/, "dialogue captions should follow the audio master clock");
assert.match(audioTimelineRuntime, /expandDialogueVisualCues/, "grouped English audio should retain per-character visual cues");
assert.ok(demo.includes(`morph-bot-element-${manifest.version}.zip`), "component workbench should link the downloadable bundle");
assert.ok(demo.includes('href="./docs/"'), "component workbench should link the readable API site");
assert.match(demo, /button-example"><button[^>]*disabled><morph-bot/, "button usage example should contain a visible bot inside the button");
for (const section of ["attributes", "properties", "methods", "events", "states", "shapes", "materials", "effects", "accessibility", "lifecycle", "typescript"]) {
  assert.ok(docs.includes(`id="${section}"`), `API site should include the ${section} section`);
}
assert.match(docs, /id="docs-bot"/, "API site should include an interactive live component");
assert.match(docsRuntime, /STATE_IDS as orderedStates/, "API site should render the full shared state reference");
assert.match(docsRuntime, /MORPH_BOT_SHAPES/, "API site should render the full exported shape reference");
assert.match(docsRuntime, /MORPH_BOT_EFFECTS/, "API site should render the full exported morph reference");
assert.match(docsRuntime, /GRADIENT_PRESETS/, "API site should render the shared material preset reference");
assert.match(docs, /playSequence\(steps, options\?\)/, "API site should document sequence playback");
assert.match(docs, /performDialogue\(script, options\?\)/, "API site should document dialogue playback");
assert.ok(existsSync(downloadPath), "downloadable component ZIP should exist");
const bundledFiles = execFileSync("unzip", ["-Z1", downloadPath], { encoding: "utf8" });
for (const file of [
  "morph-bot/catalog.js",
  "morph-bot/materials.js",
  "morph-bot/materials.d.ts",
  "morph-bot/runtime/material-system.js",
  "morph-bot/runtime/dialogue-director.js",
  "morph-bot/runtime/chinese-animalese.js",
  "morph-bot/runtime/dialogue-audio-timeline.js",
  "morph-bot/runtime/vendor/animalese-tts/animalese.browser.mjs",
  "morph-bot/runtime/vendor/animalese-tts/english-sprite.wav",
  "morph-bot/runtime/vendor/animalese-tts/english-sprite.json",
  "morph-bot/runtime/vendor/animalese-tts/LICENSE",
  "morph-bot/runtime/math.js",
  "morph-bot/runtime/morph-system.js",
  "morph-bot/runtime/particle-system.js",
  "morph-bot/runtime/physics-system.js",
  "morph-bot/runtime/simulation-clock.js",
  "morph-bot/runtime/state-behavior-system.js",
  "morph-bot/runtime/svg-renderer.js",
]) assert.match(bundledFiles, new RegExp(`^${file}$`, "m"), `download bundle should include ${file}`);
const bundledMaterialSystem = execFileSync("unzip", ["-p", downloadPath, "morph-bot/runtime/material-system.js"], { encoding: "utf8" });
assert.match(bundledMaterialSystem, /smoothMaterialStops/, "download bundle should contain perceptually smoothed gradients");
assert.match(bundledMaterialSystem, /userSpaceOnUse/, "download bundle should contain camera-anchored material lighting");
assert.doesNotMatch(bundledMaterialSystem, /causticRing/, "download bundle should not contain the removed hard reflection ring");
assert.match(bundledMaterialSystem, /"stroke-width": 1\.35/, "download bundle should contain the refined glass rim");

console.log(`Component package verified: ${component.MORPH_BOT_STATES.length} states, ${component.MORPH_BOT_SHAPES.length} shapes, ${component.MORPH_BOT_EFFECTS.length} effects, self-contained exports and a downloadable WYSIWYG workbench.`);
