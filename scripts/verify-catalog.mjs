import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  MORPH_BY_STATE,
  MORPH_CATALOG,
  MORPH_IDS,
  SHAPE_CATALOG,
  SHAPE_IDS,
  STATE_CATALOG,
  STATE_GROUPS,
  STATE_IDS,
} from "../component/catalog.js";
import { MORPH_SIZES } from "../component/grok-bot-engine.js";
import { ORIGINAL_STATE_DATA, SHAPES } from "../component/original-data.js";

const sourceStateIds = Object.keys(ORIGINAL_STATE_DATA.EXPRESSION_POOLS);
const groupedStateIds = STATE_GROUPS.flatMap(({ states }) => states);

assert.equal(STATE_IDS[0], "idle", "the shared UI catalog should put idle first");
assert.equal(new Set(STATE_IDS).size, STATE_IDS.length, "state ids must be unique");
assert.equal(new Set(SHAPE_IDS).size, SHAPE_IDS.length, "shape ids must be unique");
assert.equal(new Set(MORPH_IDS).size, MORPH_IDS.length, "morph ids must be unique");
assert.deepEqual(new Set(STATE_IDS), new Set(sourceStateIds), "catalog states must match the extracted source states");
assert.deepEqual(groupedStateIds, STATE_IDS, "state groups must include every state once in catalog order");
assert.deepEqual(SHAPE_IDS, Object.keys(SHAPES), "catalog shapes must match the extracted source shapes");
assert.deepEqual(MORPH_IDS, Object.keys(MORPH_SIZES), "catalog morphs must match the engine renderers");

for (const entry of [...STATE_CATALOG, ...SHAPE_CATALOG, ...MORPH_CATALOG]) {
  assert.ok(entry.id && entry.en && entry.zh, `catalog item ${entry.id || "<missing>"} needs bilingual labels`);
}
for (const [state, morph] of Object.entries(MORPH_BY_STATE)) {
  assert.ok(STATE_IDS.includes(state), `default morph state must exist: ${state}`);
  assert.ok(MORPH_IDS.includes(morph), `default morph effect must exist: ${morph}`);
}

for (const file of ["app.js", "component/demo.js", "component/docs/docs.js", "component/morph-bot.js"]) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
  assert.match(source, /catalog\.js/, `${file} should consume the shared catalog`);
  assert.doesNotMatch(source, /const\s+(stateLabels|shapeLabels|effectLabels|effectDescriptions|morphByState)\s*=\s*\{/, `${file} must not redefine catalog metadata`);
}

console.log(`Catalog verified: ${STATE_IDS.length} states, ${SHAPE_IDS.length} shapes, ${MORPH_IDS.length} morphs, one bilingual source.`);
