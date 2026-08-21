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

assert.equal(manifest.name, "morph-bot-element");
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
assert.throws(() => element.setState("missing"), RangeError);
assert.throws(() => element.setShape("missing"), RangeError);

const source = readFileSync(resolve(packageRoot, "morph-bot.js"), "utf8");
assert.doesNotMatch(source, /from\s+["']\.\.\//, "published component must not import outside its package");

const demo = readFileSync(resolve(packageRoot, "index.html"), "utf8");
for (const section of ['id="edit"', 'id="display"', 'id="use"']) assert.ok(demo.includes(section), `component guide should include ${section}`);

console.log(`Component package verified: ${component.MORPH_BOT_STATES.length} states, ${component.MORPH_BOT_SHAPES.length} shapes, ${component.MORPH_BOT_EFFECTS.length} effects, self-contained exports and edit/display/use guide.`);
