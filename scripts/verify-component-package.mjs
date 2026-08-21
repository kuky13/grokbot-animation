import assert from "node:assert/strict";
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

const packageRoot = resolve("component");
const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
const component = await import("../component/morph-bot.js");
const downloadPath = resolve(packageRoot, `downloads/morph-bot-element-${manifest.version}.zip`);

assert.equal(manifest.name, "morph-bot-element");
assert.equal(manifest.version, "0.1.3");
assert.equal(manifest.types, "./morph-bot.d.ts");
for (const file of manifest.files) assert.ok(existsSync(resolve(packageRoot, file)), `package file should exist: ${file}`);

assert.equal(component.MORPH_BOT_STATES.length, 39, "component should expose all source states");
assert.equal(component.MORPH_BOT_SHAPES.length, 18, "component should expose all source shapes");
assert.equal(component.MORPH_BOT_EFFECTS.length, 14, "component should expose all morph effects");
assert.ok(component.MorphBotElement.observedAttributes.includes("state"));
assert.ok(component.MorphBotElement.observedAttributes.includes("shape"));
assert.equal(typeof component.MorphBotElement.prototype.configure, "function");
assert.equal(typeof component.MorphBotElement.prototype.playMorph, "function");
assert.equal(typeof component.MorphBotElement.prototype.snapshot, "function");

const element = new component.MorphBotElement();
element.state = "thinking";
element.shape = "hex";
element.size = 72;
element.speed = 0.5;
assert.equal(element.state, "thinking");
assert.equal(element.shape, "hex");
assert.equal(element.size, 72);
assert.equal(element.speed, 0.5);
assert.equal(element.style.values.get("--morph-bot-size"), "72px");
element.setState("loading").setShape("wedge").pause();
assert.equal(element.state, "loading");
assert.equal(element.shape, "wedge");
assert.equal(element.paused, true);
element.play();
assert.equal(element.paused, false);
element.setAttribute("thumbnail", "");
assert.equal(element._engineConfig().particlesEnabled, false, "catalog thumbnails should disable particle emission");
element.removeAttribute("thumbnail");
assert.equal(element._engineConfig().particlesEnabled, true, "normal component instances should keep full particle effects");
assert.throws(() => element.setState("missing"), RangeError);
assert.throws(() => element.setShape("missing"), RangeError);

const source = readFileSync(resolve(packageRoot, "morph-bot.js"), "utf8");
assert.doesNotMatch(source, /from\s+["']\.\.\//, "published component must not import outside its package");

const demo = readFileSync(resolve(packageRoot, "index.html"), "utf8");
const demoRuntime = readFileSync(resolve(packageRoot, "demo.js"), "utf8");
for (const section of ['id="edit"', 'id="display"', 'id="use"']) assert.ok(demo.includes(section), `component guide should include ${section}`);
assert.ok(demo.includes('id="preview-stage"'), "component workbench should expose a live preview stage above the fold");
assert.ok(demo.includes('id="component-code"'), "component workbench should expose synchronized generated code");
assert.ok(demo.includes('id="state-grid"'), "component workbench should expose the complete visual state catalog");
assert.ok(demo.includes('id="shape-grid"'), "component workbench should expose the complete visual shape catalog");
assert.ok(demo.includes('id="transition-from"') && demo.includes('id="transition-to"'), "component workbench should expose A to B transition controls");
assert.doesNotMatch(demo, /常用状态|常用形状/, "component workbench must not hide choices behind a common subset");
assert.match(demoRuntime, /const orderedStates = \["idle",/, "idle should be the first visual state option");
assert.match(demoRuntime, /botThumbnail\(\{ state, shape/, "state and shape catalogs should render real component thumbnails");
assert.match(demoRuntime, /setAttribute\("thumbnail"/, "catalog previews should suppress incidental particle trails");
assert.doesNotMatch(demoRuntime, /preview\.shape = shapeInput|preview\.state = stateInput/, "catalog previews must not trigger bulk shape or state transitions");
assert.match(demoRuntime, /transitionButton\.addEventListener/, "A to B transition preview should be interactive");
assert.match(demoRuntime, /bot\.setState\(/, "generated transition usage should call the public state API");
assert.ok(demo.includes(`morph-bot-element-${manifest.version}.zip`), "component workbench should link the downloadable bundle");
assert.ok(existsSync(downloadPath), "downloadable component ZIP should exist");

console.log(`Component package verified: ${component.MORPH_BOT_STATES.length} states, ${component.MORPH_BOT_SHAPES.length} shapes, ${component.MORPH_BOT_EFFECTS.length} effects, self-contained exports and a downloadable WYSIWYG workbench.`);
