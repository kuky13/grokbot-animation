import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { HEAD_C, SHAPES } from "../component/original-data.js";

class PreviewStyle {
  constructor() { this.values = new Map(); }
  setProperty(name, value) { this.values.set(name, String(value)); }
}

class PreviewElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.attributes = new Map();
    this.children = [];
    this.parentElement = null;
    this.style = new PreviewStyle();
    this.hidden = false;
    this.textContent = "";
  }

  get firstChild() { return this.children[0] || null; }
  get nextSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return this.parentElement.children[index + 1] || null;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  append(...children) { for (const child of children) this.appendChild(child); }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  insertBefore(child, reference) {
    child.parentElement = this;
    if (!reference) this.children.push(child);
    else this.children.splice(Math.max(0, this.children.indexOf(reference)), 0, child);
    return child;
  }
  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }
  querySelector(selector) {
    if (selector === this.tagName) return this;
    for (const child of this.children) {
      const match = child.querySelector(selector);
      if (match) return match;
    }
    return null;
  }
}

const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll('"', "&quot;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;");

function serialize(element) {
  const attributes = new Map(element.attributes);
  if (element.hidden) attributes.set("display", "none");
  if (element.style.values.size) {
    const declarations = [...element.style.values].map(([name, value]) => `${name}:${value}`).join(";");
    attributes.set("style", [attributes.get("style"), declarations].filter(Boolean).join(";"));
  }
  const attrs = [...attributes].map(([name, value]) => ` ${name}="${escapeXml(value)}"`).join("");
  const content = `${element.textContent ? escapeXml(element.textContent) : ""}${element.children.map(serialize).join("")}`;
  return `<${element.tagName}${attrs}>${content}</${element.tagName}>`;
}

globalThis.document = { createElementNS: (_namespace, tagName) => new PreviewElement(tagName) };
const { MaterialSystem } = await import("../component/runtime/material-system.js");

const output = resolve(process.argv[2] || "/tmp/morph-bot-material-preview.svg");
const rotation = Number(process.argv[3] || 0);
const shapeId = process.argv[4] || "blob";
const material = process.argv[5] || "rainbow-glass";
const preset = process.argv[6] || (material === "gradient" ? "electric-dusk" : "iridescent-orb");
const shape = SHAPES[shapeId] || SHAPES.blob;

const svg = new PreviewElement("svg");
svg.id = "material-preview";
svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
svg.setAttribute("width", "900");
svg.setAttribute("height", "900");
svg.setAttribute("viewBox", "-20 -20 269 269");

const defs = new PreviewElement("defs");
const background = new PreviewElement("rect");
background.setAttribute("x", "-20");
background.setAttribute("y", "-20");
background.setAttribute("width", "269");
background.setAttribute("height", "269");
background.setAttribute("fill", "#050507");
const transformGroup = new PreviewElement("g");
transformGroup.setAttribute("transform", `rotate(${rotation} ${HEAD_C} ${HEAD_C})`);
const head = new PreviewElement("path");
head.setAttribute("id", "head-path");
head.setAttribute("d", shape.path);
transformGroup.append(head);
svg.append(defs, background, transformGroup);

const materials = new MaterialSystem(svg, { head, transformGroup, idPrefix: "preview" });
materials.apply(material === "gradient"
  ? { material, gradientPreset: preset }
  : { material: "rainbow-glass", glassPreset: preset });
materials.syncHeadPath(shape.path, rotation);
head.setAttribute("fill", svg.style.values.get("--fg"));

for (const cx of [92, 136]) {
  const eye = new PreviewElement("ellipse");
  eye.setAttribute("cx", cx);
  eye.setAttribute("cy", 106);
  eye.setAttribute("rx", 12);
  eye.setAttribute("ry", 18);
  eye.setAttribute("fill", "#ffffff");
  transformGroup.append(eye);
}

writeFileSync(output, `<?xml version="1.0" encoding="UTF-8"?>${serialize(svg)}`);
console.log(output);
