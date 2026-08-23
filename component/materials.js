const defineCatalog = (entries) => Object.freeze(entries.map((entry) => Object.freeze({
  ...entry,
  label: Object.freeze(entry.label),
  stops: entry.stops ? Object.freeze(entry.stops.map((stop) => Object.freeze(stop))) : undefined,
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
