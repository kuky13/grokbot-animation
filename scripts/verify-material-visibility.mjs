import assert from "node:assert/strict";
import { MaterialSystem } from "../component/runtime/material-system.js";

class FakeSvgElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.style = {
      values: new Map(),
      setProperty: (name, value) => this.style.values.set(name, value),
    };
  }

  get id() { return this.getAttribute("id") || ""; }
  get firstChild() { return this.children[0] || null; }
  get nextSibling() {
    if (!this.parentNode) return null;
    const index = this.parentNode.children.indexOf(this);
    return this.parentNode.children[index + 1] || null;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }

  append(...children) {
    for (const child of children) {
      child.parentNode?.removeChild(child);
      child.parentNode = this;
      this.children.push(child);
    }
  }

  appendChild(child) { this.append(child); return child; }

  insertBefore(child, reference) {
    child.parentNode?.removeChild(child);
    child.parentNode = this;
    const index = reference ? this.children.indexOf(reference) : -1;
    if (index < 0) this.children.push(child);
    else this.children.splice(index, 0, child);
    return child;
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    child.parentNode = null;
  }

  replaceChildren(...children) {
    for (const child of this.children) child.parentNode = null;
    this.children = [];
    this.append(...children);
  }

  querySelector(selector) {
    return this.children.find((child) => child.tagName === selector)
      || this.children.map((child) => child.querySelector(selector)).find(Boolean)
      || null;
  }

  remove() { this.parentNode?.removeChild(this); }
}

globalThis.document = {
  createElementNS: (_namespace, tagName) => new FakeSvgElement(tagName),
};

const svg = new FakeSvgElement("svg");
const transformGroup = new FakeSvgElement("g");
const head = new FakeSvgElement("path");
transformGroup.append(head);
svg.append(transformGroup);

const system = new MaterialSystem(svg, { head, transformGroup, idPrefix: "visibility-test" });
const isVisible = (element) => element.getAttribute("display") !== "none";
const assertLayers = ({ linear, soft, glass }, message) => {
  assert.equal(isVisible(system.gradientOverlayGroup), linear, `${message}: linear layer`);
  assert.equal(isVisible(system.softGradientGroup), soft, `${message}: soft layer`);
  assert.equal(isVisible(system.overlayGroup), glass, `${message}: glass layer`);
};

system.apply({ material: "gradient", gradientPreset: "porcelain-bloom" });
system.syncHeadPath("M0 0L228 0L228 228Z", 12);
assertLayers({ linear: false, soft: true, glass: false }, "soft gradient entry");

system.apply({ material: "solid", color: "#f9705c" });
system.syncHeadPath("M0 0L228 0L228 228Z", 0);
assertLayers({ linear: false, soft: false, glass: false }, "soft gradient to solid");
assert.equal(svg.style.values.get("--fg"), "#f9705c");

system.apply({ material: "gradient", gradientPreset: "ocean-signal" });
system.syncHeadPath("M0 0L228 0L228 228Z", -8);
assertLayers({ linear: true, soft: false, glass: false }, "linear gradient entry");

system.apply({ material: "solid", color: "#27b98b" });
assertLayers({ linear: false, soft: false, glass: false }, "linear gradient to solid");

system.apply({ material: "rainbow-glass", glassPreset: "aurora" });
system.syncHeadPath("M0 0L228 0L228 228Z", 18);
assertLayers({ linear: false, soft: false, glass: true }, "glass entry");

system.apply({ material: "solid", color: "#0b0b0b" });
assertLayers({ linear: false, soft: false, glass: false }, "glass to solid");

system.destroy();
console.log("Material visibility verified: soft gradient, linear gradient, and glass overlays all detach visually when returning to solid.");
