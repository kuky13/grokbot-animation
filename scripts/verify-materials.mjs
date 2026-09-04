import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_MATERIAL,
  GLASS_PRESETS,
  GRADIENT_PRESETS,
  MATERIAL_IDS,
  SOLID_PRESETS,
  materialCssBackground,
  resolveMaterial,
  smoothMaterialStops,
} from "../component/materials.js";

assert.deepEqual(MATERIAL_IDS, ["solid", "gradient", "rainbow-glass"]);
assert.equal(SOLID_PRESETS.length, 8);
assert.equal(GRADIENT_PRESETS.length, 12);
assert.equal(GLASS_PRESETS.length, 5);

for (const preset of SOLID_PRESETS) assert.match(preset.color, /^#[0-9a-f]{6}$/i, `${preset.id} should use a portable hex color`);
for (const preset of GRADIENT_PRESETS) {
  assert.ok(preset.angle >= 0 && preset.angle <= 360, `${preset.id} should define an explicit angle`);
  assert.ok(preset.stops.length >= 2, `${preset.id} should define ordered color stops`);
  assert.deepEqual([...preset.stops].map(({ offset }) => offset), [...preset.stops].map(({ offset }) => offset).sort((a, b) => a - b));
  assert.equal(preset.stops[0].offset, 0);
  assert.equal(preset.stops.at(-1).offset, 1);
}
const softGradients = GRADIENT_PRESETS.filter(({ kind }) => kind === "soft");
assert.equal(softGradients.length, 4);
for (const preset of softGradients) {
  assert.match(preset.base, /^#[0-9a-f]{6}$/i);
  assert.match(preset.eyeColor, /^#[0-9a-f]{6}$/i);
  assert.equal(preset.spots.length, 4);
  for (const spot of preset.spots) {
    assert.ok(spot.x >= 0 && spot.x <= 1);
    assert.ok(spot.y >= 0 && spot.y <= 1);
    assert.ok(spot.r > 0 && spot.r <= 1);
    assert.ok(spot.scaleX > 0 && spot.scaleY > 0);
    assert.ok(spot.opacity > 0 && spot.opacity <= 1);
    assert.match(spot.color, /^#[0-9a-f]{6}$/i);
  }
}
for (const preset of GLASS_PRESETS) {
  assert.ok(preset.stops.length >= 5, `${preset.id} should retain a full spectral base`);
  assert.ok(preset.sheen > 0 && preset.sheen <= 1, `${preset.id} should define a visible highlight`);
}

assert.deepEqual(resolveMaterial({}), { material: "solid", color: DEFAULT_MATERIAL.color, preset: "ink" });
assert.equal(resolveMaterial({ material: "gradient", gradientPreset: "ocean-signal" }).stops.length, 3);
const porcelain = resolveMaterial({ material: "gradient", gradientPreset: "porcelain-bloom" });
assert.equal(porcelain.kind, "soft");
assert.equal(porcelain.spots.length, 4);
assert.equal(porcelain.eyeColor, "#17203c");
assert.equal((materialCssBackground("gradient", GRADIENT_PRESETS.find(({ id }) => id === "porcelain-bloom")).match(/radial-gradient/g) || []).length, 4);
assert.deepEqual(resolveMaterial({
  material: "gradient",
  gradientPreset: "custom",
  gradientStart: "#123456",
  gradientEnd: "#abcdef",
  gradientAngle: 42,
}), {
  material: "gradient",
  preset: "custom",
  angle: 42,
  stops: [{ offset: 0, color: "#123456" }, { offset: 1, color: "#abcdef" }],
});
assert.equal(resolveMaterial({ material: "rainbow-glass", glassPreset: "aurora" }).preset, "aurora");
assert.equal(resolveMaterial({ material: "rainbow-glass" }).preset, "iridescent-orb");

const smoothStops = smoothMaterialStops([
  { offset: 0, color: "#315cf5" },
  { offset: 1, color: "#34d399" },
], 5);
assert.equal(smoothStops.length, 6, "OKLab sampling should add intermediate stops without changing the endpoints");
assert.deepEqual(smoothStops[0], { offset: 0, color: "#315cf5" });
assert.deepEqual(smoothStops.at(-1), { offset: 1, color: "#34d399" });
assert.notEqual(smoothStops[1].color, "#315cf5", "the first intermediate sample should move through perceptual color space");

const materialSystemSource = await readFile(new URL("../component/runtime/material-system.js", import.meta.url), "utf8");
assert.match(materialSystemSource, /material-soft-gradient-layers/);
assert.match(materialSystemSource, /softSpotTransform/);
assert.match(materialSystemSource, /setSvgVisible/);
assert.match(materialSystemSource, /spot\.opacity \* 0\.06/);

console.log("Material presets verified: 8 solids, 8 linear gradients, 4 soft multi-spot gradients, 5 rainbow glass variants.");
