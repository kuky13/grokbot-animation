const freezeStops = (stops) => stops ? Object.freeze(stops.map((stop) => Object.freeze(stop))) : undefined;
const defineCatalog = (entries) => Object.freeze(entries.map((entry) => Object.freeze({
  ...entry,
  label: Object.freeze(entry.label),
  stops: freezeStops(entry.stops),
  rimStops: freezeStops(entry.rimStops),
})));

export const MATERIAL_IDS = Object.freeze(["solid", "gradient", "rainbow-glass"]);

export const SOLID_PRESETS = defineCatalog([
  { id: "ink", label: { zh: "墨黑", en: "Ink" }, color: "#0b0b0b" },
  { id: "ultraviolet", label: { zh: "紫外光", en: "Ultraviolet" }, color: "#705cff" },
  { id: "signal-blue", label: { zh: "信号蓝", en: "Signal blue" }, color: "#3c82f6" },
  { id: "coral", label: { zh: "暖珊瑚", en: "Warm coral" }, color: "#f9705c" },
  { id: "mint", label: { zh: "薄荷", en: "Mint" }, color: "#27b98b" },
  { id: "solar", label: { zh: "日光", en: "Solar" }, color: "#f5b13f" },
  { id: "graphite", label: { zh: "石墨", en: "Graphite" }, color: "#45505f" },
  { id: "pearl", label: { zh: "珍珠", en: "Pearl" }, color: "#eef1f8" },
]);

// Presets use ordered stops and explicit angles so their output remains portable.
export const GRADIENT_PRESETS = defineCatalog([
  {
    id: "electric-dusk",
    label: { zh: "电光暮色", en: "Electric dusk" },
    angle: 135,
    stops: [
      { offset: 0, color: "#5658f7" },
      { offset: 0.48, color: "#9567f5" },
      { offset: 1, color: "#f36f9f" },
    ],
  },
  {
    id: "ocean-signal",
    label: { zh: "海洋信号", en: "Ocean signal" },
    angle: 130,
    stops: [
      { offset: 0, color: "#315cf5" },
      { offset: 0.52, color: "#38bdf8" },
      { offset: 1, color: "#34d399" },
    ],
  },
  {
    id: "warm-flare",
    label: { zh: "暖焰", en: "Warm flare" },
    angle: 45,
    stops: [
      { offset: 0, color: "#ff6b6b" },
      { offset: 0.5, color: "#ffb45e" },
      { offset: 1, color: "#ffe08a" },
    ],
  },
  {
    id: "mint-violet",
    label: { zh: "薄荷紫", en: "Mint violet" },
    angle: 120,
    stops: [
      { offset: 0, color: "#2dd4bf" },
      { offset: 0.5, color: "#60a5fa" },
      { offset: 1, color: "#8b5cf6" },
    ],
  },
  {
    id: "midnight-plum",
    label: { zh: "午夜李子", en: "Midnight plum" },
    angle: 145,
    stops: [
      { offset: 0, color: "#111827" },
      { offset: 0.52, color: "#4338ca" },
      { offset: 1, color: "#c026d3" },
    ],
  },
  {
    id: "peach-sky",
    label: { zh: "桃色天空", en: "Peach sky" },
    angle: 35,
    stops: [
      { offset: 0, color: "#fb7185" },
      { offset: 0.5, color: "#fdba74" },
      { offset: 1, color: "#7dd3fc" },
    ],
  },
  {
    id: "acid-lime",
    label: { zh: "酸性青柠", en: "Acid lime" },
    angle: 105,
    stops: [
      { offset: 0, color: "#14b8a6" },
      { offset: 0.46, color: "#a3e635" },
      { offset: 1, color: "#fde047" },
    ],
  },
  {
    id: "blue-hour",
    label: { zh: "蓝调时刻", en: "Blue hour" },
    angle: 160,
    stops: [
      { offset: 0, color: "#0f172a" },
      { offset: 0.55, color: "#1d4ed8" },
      { offset: 1, color: "#67e8f9" },
    ],
  },
]);

export const GLASS_PRESETS = defineCatalog([
  {
    id: "iridescent-orb",
    label: { zh: "深海虹彩", en: "Iridescent orb" },
    stops: [
      { offset: 0, color: "#eafcff" },
      { offset: 0.1, color: "#a2e9ff" },
      { offset: 0.23, color: "#3d80df" },
      { offset: 0.4, color: "#172268" },
      { offset: 0.59, color: "#090b36" },
      { offset: 0.75, color: "#190747" },
      { offset: 0.9, color: "#4b13c5" },
      { offset: 1, color: "#1d5dff" },
    ],
    rimStops: [
      { offset: 0, color: "#c7fbff" },
      { offset: 0.18, color: "#53ddff" },
      { offset: 0.42, color: "#176cff" },
      { offset: 0.68, color: "#6427ff" },
      { offset: 0.86, color: "#ff35d3" },
      { offset: 1, color: "#53f1df" },
    ],
    shadow: "#03051f",
    rim: "#bffaff",
    sheen: 0.94,
    caustic: "#6724ff",
    causticAccent: "#ff2fcf",
    depth: 0.82,
  },
  {
    id: "prism",
    label: { zh: "棱镜泡泡", en: "Prism bubble" },
    stops: [
      { offset: 0, color: "#fff7fb" },
      { offset: 0.18, color: "#ff7eb6" },
      { offset: 0.38, color: "#8b7cff" },
      { offset: 0.6, color: "#4fd8ff" },
      { offset: 0.8, color: "#58e6a9" },
      { offset: 1, color: "#ffe46b" },
    ],
    shadow: "#33216b",
    rim: "#ffffff",
    sheen: 0.76,
    caustic: "#6d5cff",
    causticAccent: "#ff65b5",
    depth: 0.52,
  },
  {
    id: "aurora",
    label: { zh: "极光玻璃", en: "Aurora glass" },
    stops: [
      { offset: 0, color: "#eaffff" },
      { offset: 0.24, color: "#39e6d0" },
      { offset: 0.52, color: "#4c8dff" },
      { offset: 0.78, color: "#b967ff" },
      { offset: 1, color: "#ff78ba" },
    ],
    shadow: "#153f69",
    rim: "#d9ffff",
    sheen: 0.7,
    caustic: "#4d62ff",
    causticAccent: "#d867ff",
    depth: 0.48,
  },
  {
    id: "candy",
    label: { zh: "糖果玻璃", en: "Candy glass" },
    stops: [
      { offset: 0, color: "#fff1f8" },
      { offset: 0.25, color: "#ff87d4" },
      { offset: 0.5, color: "#ff9068" },
      { offset: 0.75, color: "#ffd65b" },
      { offset: 1, color: "#78d8ff" },
    ],
    shadow: "#7b285d",
    rim: "#fff7fd",
    sheen: 0.8,
    caustic: "#ff704d",
    causticAccent: "#ff4fbd",
    depth: 0.42,
  },
  {
    id: "opal",
    label: { zh: "蛋白石", en: "Opal" },
    stops: [
      { offset: 0, color: "#ffffff" },
      { offset: 0.28, color: "#c8f7ff" },
      { offset: 0.52, color: "#e2d2ff" },
      { offset: 0.76, color: "#ffd7e8" },
      { offset: 1, color: "#dfffd7" },
    ],
    shadow: "#53638c",
    rim: "#ffffff",
    sheen: 0.9,
    caustic: "#9a79ff",
    causticAccent: "#ff98c7",
    depth: 0.28,
  },
]);

export const MATERIAL_LABELS = Object.freeze({
  solid: Object.freeze({ zh: "纯色", en: "Solid" }),
  gradient: Object.freeze({ zh: "渐变", en: "Gradient" }),
  "rainbow-glass": Object.freeze({ zh: "彩虹玻璃", en: "Rainbow glass" }),
});

export const DEFAULT_MATERIAL = Object.freeze({
  material: "solid",
  color: SOLID_PRESETS[0].color,
  gradientPreset: GRADIENT_PRESETS[0].id,
  gradientStart: GRADIENT_PRESETS[0].stops[0].color,
  gradientEnd: GRADIENT_PRESETS[0].stops.at(-1).color,
  gradientAngle: GRADIENT_PRESETS[0].angle,
  glassPreset: GLASS_PRESETS[0].id,
});

const findPreset = (catalog, id, fallback = catalog[0]) => catalog.find((preset) => preset.id === id) || fallback;

function parseHexColor(color) {
  const match = String(color).trim().match(/^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i);
  return match ? match.slice(1).map((part) => Number.parseInt(part, 16) / 255) : null;
}

const srgbToLinear = (value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (value) => value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;

function rgbToOklab([red, green, blue]) {
  const r = srgbToLinear(red);
  const g = srgbToLinear(green);
  const b = srgbToLinear(blue);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToHex([lightness, a, b]) {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const channels = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((value) => Math.round(Math.min(1, Math.max(0, linearToSrgb(value))) * 255));
  return `#${channels.map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

export function smoothMaterialStops(stops, subdivisions = 4) {
  if (!Array.isArray(stops) || stops.length < 2 || subdivisions < 2) return stops;
  const expanded = [];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = stops[index];
    const to = stops[index + 1];
    const fromRgb = parseHexColor(from.color);
    const toRgb = parseHexColor(to.color);
    if (!fromRgb || !toRgb) return stops;
    const fromLab = rgbToOklab(fromRgb);
    const toLab = rgbToOklab(toRgb);
    for (let sample = 0; sample < subdivisions; sample += 1) {
      const amount = sample / subdivisions;
      const lab = fromLab.map((value, channel) => value + (toLab[channel] - value) * amount);
      expanded.push({
        offset: from.offset + (to.offset - from.offset) * amount,
        color: oklabToHex(lab),
        ...(from.opacity === undefined && to.opacity === undefined ? {} : {
          opacity: (from.opacity ?? 1) + ((to.opacity ?? 1) - (from.opacity ?? 1)) * amount,
        }),
      });
    }
  }
  expanded.push({ ...stops.at(-1) });
  return expanded;
}

export function resolveMaterial(config = {}) {
  const material = MATERIAL_IDS.includes(config.material) ? config.material : DEFAULT_MATERIAL.material;
  if (material === "solid") {
    const color = config.color || DEFAULT_MATERIAL.color;
    return {
      material,
      color,
      preset: SOLID_PRESETS.find((preset) => preset.color.toLowerCase() === String(color).toLowerCase())?.id || "custom",
    };
  }
  if (material === "gradient") {
    if (config.gradientPreset === "custom") {
      return {
        material,
        preset: "custom",
        angle: Number.isFinite(Number(config.gradientAngle)) ? Number(config.gradientAngle) : DEFAULT_MATERIAL.gradientAngle,
        stops: [
          { offset: 0, color: config.gradientStart || DEFAULT_MATERIAL.gradientStart },
          { offset: 1, color: config.gradientEnd || DEFAULT_MATERIAL.gradientEnd },
        ],
      };
    }
    const preset = findPreset(GRADIENT_PRESETS, config.gradientPreset);
    return { material, preset: preset.id, angle: preset.angle, stops: preset.stops };
  }
  const preset = findPreset(GLASS_PRESETS, config.glassPreset);
  return { material, preset: preset.id, ...preset };
}
