import { resolveMaterial, smoothMaterialStops } from "../materials.js";
import { HEAD_C } from "../original-data.js";

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
  const dx = Math.sin(radians) * HEAD_C;
  const dy = -Math.cos(radians) * HEAD_C;
  return {
    x1: HEAD_C - dx,
    y1: HEAD_C - dy,
    x2: HEAD_C + dx,
    y2: HEAD_C + dy,
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
      gradientLight: `${safePrefix}-gradient-light`,
      gradientShade: `${safePrefix}-gradient-shade`,
      glass: `${safePrefix}-glass-base`,
      shadow: `${safePrefix}-glass-shadow`,
      caustic: `${safePrefix}-glass-caustic`,
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
      gradientUnits: "userSpaceOnUse",
      "color-interpolation": "sRGB",
    });
    this.gradientLight = svgElement("radialGradient", {
      id: this.ids.gradientLight,
      gradientUnits: "userSpaceOnUse",
      cx: 45.7,
      cy: 27.4,
      r: 178.3,
      fx: 45.7,
      fy: 27.4,
      "color-interpolation": "sRGB",
    });
    this.gradientShade = svgElement("radialGradient", {
      id: this.ids.gradientShade,
      gradientUnits: "userSpaceOnUse",
      cx: 54.9,
      cy: 27.4,
      r: 246.8,
      fx: 54.9,
      fy: 27.4,
      "color-interpolation": "sRGB",
    });
    this.glass = svgElement("radialGradient", {
      id: this.ids.glass,
      gradientUnits: "userSpaceOnUse",
      cx: 144,
      cy: 162.3,
      r: 219.4,
      fx: 50.3,
      fy: 32,
      "color-interpolation": "sRGB",
    });
    this.shadow = svgElement("radialGradient", {
      id: this.ids.shadow,
      gradientUnits: "userSpaceOnUse",
      cx: 64,
      cy: 41.1,
      r: 210.3,
    });
    this.caustic = svgElement("radialGradient", {
      id: this.ids.caustic,
      gradientUnits: "userSpaceOnUse",
      cx: 166.8,
      cy: 171.4,
      r: 132.6,
      fx: 166.8,
      fy: 171.4,
    });
    this.sheen = svgElement("radialGradient", {
      id: this.ids.sheen,
      gradientUnits: "userSpaceOnUse",
      cx: 50.3,
      cy: 27.4,
      r: 123.4,
      fx: 50.3,
      fy: 27.4,
    });
    this.rim = svgElement("linearGradient", {
      id: this.ids.rim,
      gradientUnits: "userSpaceOnUse",
      x1: 27.4,
      y1: 13.7,
      x2: 201.1,
      y2: 214.8,
    });
    defs.append(
      this.gradient,
      this.gradientLight,
      this.gradientShade,
      this.glass,
      this.shadow,
      this.caustic,
      this.sheen,
      this.rim,
    );

    this.gradientOverlayGroup = svgElement("g", { class: "material-gradient-layers", "pointer-events": "none" });
    this.gradientLightPath = svgElement("path", { fill: `url(#${this.ids.gradientLight})` });
    this.gradientShadePath = svgElement("path", { fill: `url(#${this.ids.gradientShade})` });
    this.gradientOverlayGroup.append(this.gradientLightPath, this.gradientShadePath);

    this.overlayGroup = svgElement("g", { class: "material-glass-layers", "pointer-events": "none" });
    this.shadowPath = svgElement("path", { fill: `url(#${this.ids.shadow})` });
    this.causticPath = svgElement("path", { fill: `url(#${this.ids.caustic})`, style: "mix-blend-mode:screen" });
    this.sheenPath = svgElement("path", { fill: `url(#${this.ids.sheen})`, style: "mix-blend-mode:screen" });
    this.rimPath = svgElement("path", {
      fill: "none",
      stroke: `url(#${this.ids.rim})`,
      "stroke-width": 1.35,
      opacity: 0.7,
    });
    this.overlayGroup.append(this.shadowPath, this.causticPath, this.sheenPath, this.rimPath);
    transformGroup.insertBefore(this.gradientOverlayGroup, head.nextSibling || null);
    transformGroup.insertBefore(this.overlayGroup, this.gradientOverlayGroup.nextSibling || null);
    this.gradientOverlayGroup.hidden = true;
    this.overlayGroup.hidden = true;
  }

  apply(config) {
    const material = resolveMaterial(config);
    const signature = JSON.stringify(material);
    if (signature !== this.signature) {
      this.signature = signature;
      this.updateDefinitions(material);
    }
    this.gradientOverlayGroup.hidden = material.material !== "gradient";
    this.overlayGroup.hidden = material.material !== "rainbow-glass";
    if (material.material === "solid") this.svg.style.setProperty("--fg", material.color);
    else if (material.material === "gradient") this.svg.style.setProperty("--fg", `url(#${this.ids.gradient})`);
    else this.svg.style.setProperty("--fg", `url(#${this.ids.glass})`);
    return material;
  }

  updateDefinitions(material) {
    if (material.material === "gradient") {
      const vector = gradientVector(material.angle);
      for (const [name, value] of Object.entries(vector)) this.gradient.setAttribute(name, value.toFixed(3));
      replaceStops(this.gradient, smoothMaterialStops(material.stops, 5));
      replaceStops(this.gradientLight, [
        { offset: 0, color: "#ffffff", opacity: 0.2 },
        { offset: 0.28, color: "#ffffff", opacity: 0.08 },
        { offset: 0.72, color: "#ffffff", opacity: 0 },
        { offset: 1, color: "#ffffff", opacity: 0 },
      ]);
      replaceStops(this.gradientShade, [
        { offset: 0, color: "#070b22", opacity: 0 },
        { offset: 0.52, color: "#070b22", opacity: 0 },
        { offset: 0.82, color: "#070b22", opacity: 0.08 },
        { offset: 1, color: "#070b22", opacity: 0.2 },
      ]);
      return;
    }
    if (material.material !== "rainbow-glass") return;
    replaceStops(this.glass, smoothMaterialStops(material.stops, 3));
    const depth = material.depth ?? 0.5;
    replaceStops(this.shadow, [
      { offset: 0, color: "#ffffff", opacity: 0 },
      { offset: 0.42, color: material.shadow, opacity: 0.01 },
      { offset: 0.7, color: material.shadow, opacity: depth * 0.18 },
      { offset: 1, color: material.shadow, opacity: depth * 0.76 },
    ]);
    replaceStops(this.caustic, [
      { offset: 0, color: material.causticAccent, opacity: 0.58 },
      { offset: 0.18, color: material.caustic, opacity: 0.48 },
      { offset: 0.5, color: material.caustic, opacity: 0.12 },
      { offset: 0.74, color: material.caustic, opacity: 0 },
      { offset: 1, color: material.caustic, opacity: 0 },
    ]);
    replaceStops(this.sheen, [
      { offset: 0, color: "#ffffff", opacity: material.sheen },
      { offset: 0.14, color: "#e9fbff", opacity: material.sheen * 0.72 },
      { offset: 0.3, color: "#b7ecff", opacity: material.sheen * 0.3 },
      { offset: 0.56, color: "#ffffff", opacity: 0.025 },
      { offset: 1, color: "#ffffff", opacity: 0 },
    ]);
    const rimStops = material.rimStops || [
      { offset: 0, color: material.rim, opacity: 0.92 },
      { offset: 0.28, color: material.rim, opacity: 0.18 },
      { offset: 0.62, color: material.shadow, opacity: 0.26 },
      { offset: 0.84, color: material.causticAccent, opacity: 0.82 },
      { offset: 1, color: material.rim, opacity: 0.76 },
    ];
    replaceStops(this.rim, smoothMaterialStops(rimStops, 2));
  }

  syncHeadPath(path, rotation = 0) {
    if (!path) return;
    const inverseRotation = `rotate(${(-rotation).toFixed(3)} ${HEAD_C} ${HEAD_C})`;
    for (const gradient of [
      this.gradient,
      this.gradientLight,
      this.gradientShade,
      this.glass,
      this.shadow,
      this.caustic,
      this.sheen,
      this.rim,
    ]) gradient.setAttribute("gradientTransform", inverseRotation);
    if (!this.gradientOverlayGroup.hidden) {
      this.gradientLightPath.setAttribute("d", path);
      this.gradientShadePath.setAttribute("d", path);
    }
    if (!this.overlayGroup.hidden) {
      this.shadowPath.setAttribute("d", path);
      this.causticPath.setAttribute("d", path);
      this.sheenPath.setAttribute("d", path);
      this.rimPath.setAttribute("d", path);
    }
  }

  destroy() {
    this.overlayGroup.remove();
    this.gradientOverlayGroup.remove();
    this.gradient.remove();
    this.gradientLight.remove();
    this.gradientShade.remove();
    this.glass.remove();
    this.shadow.remove();
    this.caustic.remove();
    this.sheen.remove();
    this.rim.remove();
    if (this.ownsDefs) this.defs.remove();
  }
}
