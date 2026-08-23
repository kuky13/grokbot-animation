import assert from "node:assert/strict";
import {
  DEFAULT_MATERIAL,
  GLASS_PRESETS,
  GRADIENT_PRESETS,
  MATERIAL_IDS,
  SOLID_PRESETS,
  resolveMaterial,
} from "../component/materials.js";

assert.deepEqual(MATERIAL_IDS, ["solid", "gradient", "rainbow-glass"]);
assert.equal(SOLID_PRESETS.length, 8);
assert.equal(GRADIENT_PRESETS.length, 8);
assert.equal(GLASS_PRESETS.length, 4);

for (const preset of SOLID_PRESETS) assert.match(preset.color, /^#[0-9a-f]{6}$/i, `${preset.id} should use a portable hex color`);
for (const preset of GRADIENT_PRESETS) {
  assert.ok(preset.angle >= 0 && preset.angle <= 360, `${preset.id} should define an explicit angle`);
  assert.ok(preset.stops.length >= 2, `${preset.id} should define ordered color stops`);
  assert.deepEqual([...preset.stops].map(({ offset }) => offset), [...preset.stops].map(({ offset }) => offset).sort((a, b) => a - b));
  assert.equal(preset.stops[0].offset, 0);
  assert.equal(preset.stops.at(-1).offset, 1);
}
for (const preset of GLASS_PRESETS) {
  assert.ok(preset.stops.length >= 5, `${preset.id} should retain a full spectral base`);
  assert.ok(preset.sheen > 0 && preset.sheen <= 1, `${preset.id} should define a visible highlight`);
}

assert.deepEqual(resolveMaterial({}), { material: "solid", color: DEFAULT_MATERIAL.color, preset: "ink" });
assert.equal(resolveMaterial({ material: "gradient", gradientPreset: "ocean-signal" }).stops.length, 3);
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

console.log("Material presets verified: 8 solids, 8 gradients, 4 rainbow glass variants.");
