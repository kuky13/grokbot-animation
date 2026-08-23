import { resolveMaterial } from "../materials.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, String(value));
  return element;
}

function replaceStops(gradient, stops) {
  if (typeof gradient.replaceChildren === "function") gradient.replaceChildren();
  else gradient.children = [];
  for (const stop of stops) {
    gradient.appendChild(svgElement("stop", {
      offset: `${Math.round(stop.offset * 1000) / 10}%`,
      "stop-color": stop.color,
      ...(stop.opacity === undefined ? {} : { "stop-opacity": stop.opacity }),
    }));
  }
}

function gradientVector(angle) {
  const radians = Number(angle) * Math.PI / 180;
  const dx = Math.sin(radians) * 0.5;
  const dy = -Math.cos(radians) * 0.5;
  return {
    x1: 0.5 - dx,
    y1: 0.5 - dy,
    x2: 0.5 + dx,
    y2: 0.5 + dy,
  };
}

export class MaterialSystem {
  constructor(svg, { head, transformGroup, idPrefix = "morph-bot" }) {
    this.svg = svg;
    this.head = head;
    this.signature = "";
    const safePrefix = String(idPrefix).replace(/[^a-zA-Z0-9_-]/g, "-");
    this.ids = {
      gradient: `${safePrefix}-material-gradient`,
      glass: `${safePrefix}-glass-base`,
      shadow: `${safePrefix}-glass-shadow`,
      sheen: `${safePrefix}-glass-sheen`,
      rim: `${safePrefix}-glass-rim`,
    };

    let defs = svg.querySelector("defs");
    if (!defs) {
      defs = svgElement("defs");
      svg.insertBefore(defs, svg.firstChild || null);
      this.ownsDefs = true;
    }
    this.defs = defs;
    this.gradient = svgElement("linearGradient", {
      id: this.ids.gradient,
      gradientUnits: "objectBoundingBox",
      "color-interpolation": "linearRGB",
    });
    this.glass = svgElement("radialGradient", {
      id: this.ids.glass,
      cx: "64%",
      cy: "72%",
      r: "92%",
      fx: "26%",
      fy: "20%",
      "color-interpolation": "linearRGB",
    });
    this.shadow = svgElement("radialGradient", {
      id: this.ids.shadow,
      cx: "30%",
      cy: "22%",
      r: "86%",
    });
    this.sheen = svgElement("radialGradient", {
      id: this.ids.sheen,
      cx: "25%",
      cy: "18%",
      r: "58%",
    });
    this.rim = svgElement("linearGradient", {
      id: this.ids.rim,
      x1: "12%",
      y1: "6%",
      x2: "88%",
      y2: "94%",
    });
    defs.append(this.gradient, this.glass, this.shadow, this.sheen, this.rim);

    this.overlayGroup = svgElement("g", { class: "material-glass-layers", "pointer-events": "none" });
    this.shadowPath = svgElement("path", { fill: `url(#${this.ids.shadow})` });
    this.sheenPath = svgElement("path", { fill: `url(#${this.ids.sheen})` });
    this.rimPath = svgElement("path", {
      fill: "none",
      stroke: `url(#${this.ids.rim})`,
      "stroke-width": 3.2,
    });
    this.overlayGroup.append(this.shadowPath, this.sheenPath, this.rimPath);
    transformGroup.insertBefore(this.overlayGroup, head.nextSibling || null);
    this.overlayGroup.hidden = true;
  }

  apply(config) {
    const material = resolveMaterial(config);
    const signature = JSON.stringify(material);
    if (signature !== this.signature) {
      this.signature = signature;
      this.updateDefinitions(material);
    }
    this.overlayGroup.hidden = material.material !== "rainbow-glass";
    if (material.material === "solid") this.svg.style.setProperty("--fg", material.color);
    else if (material.material === "gradient") this.svg.style.setProperty("--fg", `url(#${this.ids.gradient})`);
    else this.svg.style.setProperty("--fg", `url(#${this.ids.glass})`);
    return material;
  }

  updateDefinitions(material) {
    if (material.material === "gradient") {
      const vector = gradientVector(material.angle);
      for (const [name, value] of Object.entries(vector)) this.gradient.setAttribute(name, `${value * 100}%`);
      replaceStops(this.gradient, material.stops);
      return;
    }
    if (material.material !== "rainbow-glass") return;
    replaceStops(this.glass, material.stops);
    replaceStops(this.shadow, [
      { offset: 0, color: "#ffffff", opacity: 0 },
      { offset: 0.56, color: material.shadow, opacity: 0.02 },
      { offset: 1, color: material.shadow, opacity: 0.52 },
    ]);
    replaceStops(this.sheen, [
      { offset: 0, color: "#ffffff", opacity: material.sheen },
      { offset: 0.28, color: "#ffffff", opacity: material.sheen * 0.44 },
      { offset: 0.64, color: "#ffffff", opacity: 0.04 },
      { offset: 1, color: "#ffffff", opacity: 0 },
    ]);
    replaceStops(this.rim, [
      { offset: 0, color: material.rim, opacity: 0.92 },
      { offset: 0.28, color: material.rim, opacity: 0.18 },
      { offset: 0.7, color: material.shadow, opacity: 0.28 },
      { offset: 1, color: material.rim, opacity: 0.76 },
    ]);
  }

  syncHeadPath(path) {
    if (this.overlayGroup.hidden || !path) return;
    this.shadowPath.setAttribute("d", path);
    this.sheenPath.setAttribute("d", path);
    this.rimPath.setAttribute("d", path);
  }

  destroy() {
    this.overlayGroup.remove();
    this.gradient.remove();
    this.glass.remove();
    this.shadow.remove();
    this.sheen.remove();
    this.rim.remove();
    if (this.ownsDefs) this.defs.remove();
  }
}
