import { CIRCLE_RING, EXPRESSIONS, ORIGINAL_STATE_DATA, SHAPES } from "../original-data.js";

const expectedStates = [
  "sleeping", "waking", "idle", "listening", "thinking", "searching", "working",
  "excited", "surprised", "suspicious", "angry", "drowsy", "happy", "curious",
  "confused", "bored", "proud", "shy", "sad", "laughing", "scared", "playful",
  "celebrate", "orbit", "radar", "progress", "spawning", "humming", "loading",
  "dictating", "writing", "sending", "receiving", "uploading", "notifying",
  "alerting", "dragging", "bouncing", "powering-down",
];

const failures = [];
const pools = ORIGINAL_STATE_DATA.EXPRESSION_POOLS;
if (Object.keys(pools).length !== expectedStates.length) failures.push(`Expected 39 states, got ${Object.keys(pools).length}`);
for (const state of expectedStates) {
  if (!pools[state]) failures.push(`Missing expression pool: ${state}`);
  if (!ORIGINAL_STATE_DATA.EXPRESSION_CADENCE[state]) failures.push(`Missing expression cadence: ${state}`);
}
if (EXPRESSIONS.length !== 25) failures.push(`Expected 25 expressions, got ${EXPRESSIONS.length}`);
for (const [index, expression] of EXPRESSIONS.entries()) {
  if (expression.length !== 2) failures.push(`Expression ${index} does not have two eyes`);
  for (const eye of expression) if (eye.length !== 48) failures.push(`Expression ${index} has an eye with ${eye.length} points`);
}
if (Object.keys(SHAPES).length !== 18) failures.push(`Expected 18 shapes, got ${Object.keys(SHAPES).length}`);
for (const [shape, data] of Object.entries(SHAPES)) {
  if (data.ring.length !== 96) failures.push(`${shape} ring has ${data.ring.length} points`);
  if (data.spanSamples.length !== 160) failures.push(`${shape} span table has ${data.spanSamples.length} samples`);
}
if (CIRCLE_RING.length !== 96) failures.push(`Circle ring has ${CIRCLE_RING.length} points`);
for (const [state, pool] of Object.entries(pools)) {
  for (const index of pool) if (!EXPRESSIONS[index]) failures.push(`${state} references missing expression ${index}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Original data verified: 39 states, 25 expressions, 18 shapes, 96-point rings, 160-sample span tables.");
}
