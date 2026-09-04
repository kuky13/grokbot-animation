import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [html, css, app, componentPage, buildScript] = await Promise.all([
  readFile(path.join(repo, "aurora-orb/index.html"), "utf8"),
  readFile(path.join(repo, "aurora-orb/aurora-orb.css"), "utf8"),
  readFile(path.join(repo, "aurora-orb/aurora-orb.js"), "utf8"),
  readFile(path.join(repo, "component/index.html"), "utf8"),
  readFile(path.join(repo, "scripts/build-static.sh"), "utf8"),
]);

assert.match(html, /<canvas id="gl"/);
assert.match(html, /<morph-bot[\s\S]*id="orb-face"[\s\S]*follow-pointer/);
assert.match(html, /const int STEPS = 12/);
assert.match(html, /uniform vec2 uPointerTrail/);
assert.match(html, /trailInfluence/);
assert.match(html, /aurora-pointer/);
assert.match(html, /data:image\/webp;base64,/);

assert.match(app, /import "\.\.\/component\/morph-bot\.js"/);
assert.match(app, /Object\.fromEntries\(FACIAL_STATE_IDS\.map\(\(id\) => \[id, \{ morph: "none" \}\]\)\)/);
assert.match(app, /reactWith\("surprised", 760\)/);
assert.match(app, /reactWith\("curious", 680\)/);
assert.match(app, /installOrbEyeMaterial/);
assert.match(app, /aurora-eye-depth/);
assert.doesNotMatch(html, /给液体一双会回应你的眼睛/);
assert.match(html, /id="eye-settings"/);
assert.match(html, /id="eye-color"/);
assert.match(html, /id="eye-opacity"/);
assert.match(html, /id="eye-scale"/);
assert.match(html, /id="eye-blend-mode"/);
assert.match(app, /EYE_CONFIG_STORAGE_KEY/);
assert.match(app, /applyEyeConfig/);

const blendOptions = html.match(/id="eye-blend-mode">([\s\S]*?)<\/select>/)?.[1] || "";
const blendModes = [...blendOptions.matchAll(/value="([a-z-]+)"/g)].map((match) => match[1]);
assert.deepEqual(blendModes, [
  "normal", "multiply", "screen", "overlay", "darken", "lighten", "color-dodge", "color-burn", "hard-light",
  "soft-light", "difference", "exclusion", "hue", "saturation", "color", "luminosity", "plus-darker", "plus-lighter",
]);

const stateArray = app.match(/FACIAL_STATE_IDS = Object\.freeze\(\[([\s\S]*?)\]\);/)?.[1] || "";
const stateIds = [...stateArray.matchAll(/"([a-z-]+)"/g)].map((match) => match[1]);
assert.equal(stateIds.length, 23);
assert.equal(stateIds[0], "idle");
assert.equal(new Set(stateIds).size, stateIds.length);

assert.match(css, /#orb-face/);
assert.match(css, /\.expression-list/);
assert.match(css, /@media \(max-width: 760px\)/);
assert.match(css, /prefers-reduced-motion/);
assert.match(componentPage, /href="\.\.\/aurora-orb\/"/);
assert.match(buildScript, /cp -R "\$repo_dir\/aurora-orb" "\$output_dir\/aurora-orb"/);

console.log("Aurora Orb verification passed: volumetric renderer, inertial pointer wake, 23 expression states, reactive gaze, responsive controls, and static build route.");
