import assert from "node:assert/strict";

let clock = 0;
globalThis.performance = { now: () => clock };

class FakeStyle {
  setProperty(name, value) { this[name] = value; }
}

class FakeElement {
  constructor() {
    this.attributes = new Map();
    this.children = [];
    this.style = new FakeStyle();
    this.hidden = false;
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
  append(child) { this.children.push(child); }
  appendChild(child) { this.children.push(child); return child; }
  insertBefore(child) { this.children.push(child); return child; }
  remove() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 390 }; }
}

const nodes = {
  head: new FakeElement(),
  clip: new FakeElement(),
  transform: new FakeElement(),
  eyes: [new FakeElement(), new FakeElement()],
  morphHeads: [new FakeElement(), new FakeElement()],
  rings: Array.from({ length: 5 }, () => new FakeElement()),
  parts: Array.from({ length: 5 }, () => new FakeElement()),
  glyphs: Array.from({ length: 3 }, () => new FakeElement()),
  badge: new FakeElement(),
  particlesBack: new FakeElement(),
  particlesFront: new FakeElement(),
};

const svg = new FakeElement();
svg.dataset = {};
svg.querySelector = (selector) => ({
  "#head-path": nodes.head,
  "#head-clip-path": nodes.clip,
  "#bot-transform": nodes.transform,
  "#notify-badge": nodes.badge,
  "#particles-back": nodes.particlesBack,
  "#particles-front": nodes.particlesFront,
})[selector];
svg.querySelectorAll = (selector) => ({
  ".eye-path": nodes.eyes,
  ".morph-head": nodes.morphHeads,
  ".morph-ring": nodes.rings,
  ".morph-part": nodes.parts,
  ".morph-glyph": nodes.glyphs,
})[selector] || [];

globalThis.window = {
  matchMedia: () => ({ matches: false }),
  addEventListener() {},
  removeEventListener() {},
};
globalThis.document = {
  documentElement: { addEventListener() {}, removeEventListener() {} },
  createElementNS: () => new FakeElement(),
};
globalThis.requestAnimationFrame = () => 0;
globalThis.cancelAnimationFrame = () => {};

const { GrokBotEngine } = await import("../grok-bot-engine.js");
const { EXPRESSIONS, HEAD_C, SHAPES } = await import("../original-data.js");

let activeState = "idle";
const baseConfig = {
  shape: "blob", color: "#0b0b0b", eyeColor: "#fff", size: 390, flipX: false,
  pointer: false, badgeColor: "#1d9bf0", badgeScale: 1,
  expressionPool: [0], expressionCadence: [999999, 999999], blinkCadence: null,
  morph: "none", headX: 0, headY: 0, headRotation: 0, scaleX: 1, scaleY: 1,
  eyeOpen: 1, eyeScale: 1, gazeScale: 1, motionScale: 1, tempo: 1,
};

const morphStates = {
  thinking: "dots",
  orbit: "orbit",
  radar: "radar",
  progress: "progress",
  spawning: "gather",
  dictating: "wave",
  sending: "send",
  receiving: "receive",
  uploading: "dock",
  bouncing: "ball",
  loading: "whirl",
  "powering-down": "standby",
  writing: "pencil",
  alerting: "bang",
};

const configs = { idle: baseConfig, humming: baseConfig };
for (const [state, morph] of Object.entries(morphStates)) {
  configs[state] = { ...baseConfig, morph };
}
const allStates = [
  "sleeping", "waking", "idle", "listening", "thinking", "searching", "working",
  "excited", "surprised", "suspicious", "angry", "drowsy", "happy", "curious",
  "confused", "bored", "proud", "shy", "sad", "laughing", "scared", "playful",
  "celebrate", "orbit", "radar", "progress", "spawning", "humming", "loading",
  "dictating", "writing", "sending", "receiving", "uploading", "notifying",
  "alerting", "dragging", "bouncing", "powering-down",
];
for (const state of allStates) configs[state] ||= baseConfig;
configs.drowsy = {
  ...baseConfig,
  expressionPool: [4, 22, 13],
  expressionCadence: [4000, 8000],
};

const engine = new GrokBotEngine(svg, () => configs[activeState]);
const advance = (milliseconds) => {
  const frames = Math.ceil(milliseconds / (1000 / 60));
  for (let frame = 0; frame < frames; frame += 1) {
    clock += 1000 / 60;
    engine.frame(clock);
  }
};

const centroid = (ring) => {
  const sum = ring.reduce((value, point) => [value[0] + point[0], value[1] + point[1]], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
};

const spanAt = (ring, y) => {
  let left = -Infinity;
  let right = Infinity;
  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    if ((start[1] <= y) === (end[1] <= y)) continue;
    const x = start[0] + (end[0] - start[0]) * (y - start[1]) / (end[1] - start[1]);
    if (x <= HEAD_C) left = Math.max(left, x);
    else right = Math.min(right, x);
  }
  return [Number.isFinite(left) ? left : HEAD_C, Number.isFinite(right) ? right : HEAD_C];
};

const parseEyeTransform = (value) => {
  const match = value.match(/^translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+) ([-\d.]+)\) translate\(/);
  assert.ok(match, `eye transform should use the expected source transform: ${value}`);
  return match.slice(1).map(Number);
};

const near = (actual, expected, tolerance, message) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}; expected ${expected}, received ${actual}`);
};

activeState = "drowsy";
engine.setState("drowsy", true);
engine.gesture = null;
engine.spinSpring = null;
engine.listenNodNext = Number.POSITIVE_INFINITY;
engine.drowsyStartedAt = clock || 1;
const drowsyStart = engine.drowsyStartedAt;
const sampleDrowsy = (seconds) => {
  engine.updateStateTargets(drowsyStart + seconds * 1000, configs.drowsy, 1 / 60);
  return {
    y: engine.headY.target,
    rotation: engine.rotation.target * 180 / Math.PI,
    eyeOpen: engine.eyeOpen.target,
  };
};

const nodBottom = sampleDrowsy(1.7);
near(nodBottom.y, 25, 0.0001, "drowsy should sink to the source nod depth");
near(nodBottom.rotation, 10, 0.0001, "drowsy should reach the source nod angle");
near(nodBottom.eyeOpen, 0.04, 0.0001, "drowsy eyes should nearly close at the nod bottom");

const reboundPeak = sampleDrowsy(1.85);
near(reboundPeak.y, 18, 0.0001, "drowsy should rebound by the source amount");
near(reboundPeak.rotation, 6, 0.0001, "drowsy should rebound to the source angle");
near(reboundPeak.eyeOpen, 0.46, 0.0001, "drowsy eyes should reopen during the rebound");

const sleepyBlink = sampleDrowsy(2.55);
near(sleepyBlink.eyeOpen, 0.05, 0.0001, "drowsy should keep the source recovery blink");

engine.pointer.active = false;
engine.pointer.x = 0;
engine.pointer.y = 0;
engine.aimX.x = 10;
engine.aimY.x = 8;
engine.morph.x = 0;
engine.turn.x = 0;
engine.renderEyes(drowsyStart + 900, configs.drowsy, SHAPES.blob, SHAPES.blob.ring, 0, 0);
const autonomousEye = parseEyeTransform(nodes.eyes[0].getAttribute("transform"));
engine.pointer.active = true;
engine.pointer.clientX = 195;
engine.pointer.clientY = 195;
engine.pointer.x = 0;
engine.pointer.y = 0;
engine.renderEyes(drowsyStart + 900, { ...configs.drowsy, pointer: true }, SHAPES.blob, SHAPES.blob.ring, 0, 0);
const pointerEye = parseEyeTransform(nodes.eyes[0].getAttribute("transform"));
near(autonomousEye[0] - pointerEye[0], 8, 0.02, "pointer tracking should reduce autonomous horizontal drowsy gaze to 20%");
near(autonomousEye[1] - pointerEye[1], 6.4, 0.02, "pointer tracking should reduce autonomous vertical drowsy gaze to 20%");
engine.pointer.active = false;

const eyeReturnTimes = [];
for (const [state, effect] of Object.entries(morphStates)) {
  activeState = state;
  engine.setState(state);
  advance(700);
  assert.ok(engine.morph.x > 0.95, `${state} should fully enter its ${effect} morph`);
  assert.equal(engine.morphEffect, effect, `${state} should render the ${effect} effect`);
  assert.ok(nodes.eyes.every((eye) => eye.style.display === "none"), `${state} should hide both eyes while morphed`);

  activeState = "idle";
  engine.setState("idle");
  let eyeReturnMs = null;
  for (let elapsed = 1000 / 60; elapsed <= 1000; elapsed += 1000 / 60) {
    advance(1000 / 60);
    if (nodes.eyes.every((eye) => eye.style.display !== "none")) {
      eyeReturnMs = elapsed;
      break;
    }
  }

  assert.ok(eyeReturnMs !== null, `eyes should return after leaving ${state}`);
  assert.ok(eyeReturnMs < 250, `${state} should restore eyes promptly; observed ${eyeReturnMs.toFixed(1)}ms`);
  eyeReturnTimes.push(eyeReturnMs);
  advance(800);
  assert.ok(engine.morph.x < 0.004, `${state} morph should fully exit`);
  assert.equal(engine.morphEffect, null, `${state} effect should be released after exit`);
  assert.ok(nodes.eyes.every((eye) => eye.style.display !== "none"), `eyes should remain visible after ${state}`);
}

activeState = "humming";
engine.setState("humming");
advance(1800);
assert.ok(engine.particles.particles.some((particle) => particle.orbit), "humming should emit the original orbit trails");

activeState = "loading";
engine.setState("loading");
advance(1800);
assert.ok(engine.particles.particles.some((particle) => particle.orbit), "loading should retain orbit trail particles");

const directStates = Object.entries(morphStates);
activeState = directStates[0][0];
engine.setState(activeState);
advance(700);
for (let index = 1; index < directStates.length; index += 1) {
  const [previousState, previousEffect] = directStates[index - 1];
  const [nextState, nextEffect] = directStates[index];
  activeState = nextState;
  engine.setState(nextState);
  advance(50);
  assert.equal(engine.previousMorphEffect, previousEffect, `${previousState} -> ${nextState} should retain the outgoing effect`);
  assert.equal(engine.morphEffect, nextEffect, `${previousState} -> ${nextState} should activate the incoming effect`);
  const previousLayer = engine.morphLayers.get(previousEffect);
  const nextLayer = engine.morphLayers.get(nextEffect);
  assert.ok(previousLayer && !previousLayer.group.hidden, `${previousEffect} should remain in its own visible SVG layer`);
  assert.ok(nextLayer && !nextLayer.group.hidden, `${nextEffect} should render in its own visible SVG layer`);
  assert.notEqual(previousLayer, nextLayer, `${previousEffect} and ${nextEffect} must not overwrite one another`);
  advance(650);
}

for (const effect of ["radar", "progress", "send", "receive", "standby"]) {
  const layer = engine.morphLayers.get(effect);
  assert.ok(layer, `${effect} should have an SVG layer`);
  assert.ok(layer.rings.every((ring) => Number(ring.getAttribute("cx")) === 114.2705 && Number(ring.getAttribute("cy")) === 114.2705), `${effect} rings should stay centered`);
}

activeState = "progress";
engine.setState("progress");
const firstProgressShot = engine.morphShotStartedAt;
advance(2700);
assert.equal(engine.oneShotResting, true, "progress should leave the morph for its source 1500ms rest");
assert.equal(engine.morph.target, 0, "progress rest should target the base bot");
advance(1600);
assert.equal(engine.oneShotResting, false, "progress should begin its next shot after resting");
assert.equal(engine.morph.target, 1, "progress should re-enter for its next shot");
assert.ok(engine.morphShotStartedAt > firstProgressShot, "progress should use a fresh shot timer on replay");
const progressLayer = engine.morphLayers.get("progress");
const circumference = Number(progressLayer.rings[4].getAttribute("stroke-dasharray"));
const offset = Number(progressLayer.rings[4].getAttribute("stroke-dashoffset"));
assert.ok(1 - offset / circumference < 0.25, "progress replay should restart near zero instead of staying complete");

activeState = "spawning";
engine.setState("spawning");
const firstGatherShot = engine.morphShotStartedAt;
advance(2200);
assert.equal(engine.oneShotResting, true, "spawning should leave the morph after its source shot");
advance(1600);
assert.equal(engine.oneShotResting, false, "spawning should replay after its source rest");
assert.ok(engine.morphShotStartedAt > firstGatherShot, "spawning should use a fresh gather timer on replay");

activeState = "notifying";
engine.setState("notifying");
advance(500);
assert.equal(nodes.badge.hidden, false, "notifying should show the badge");

activeState = "dragging";
engine.setState("dragging");
advance(2400);
assert.ok(Number.isFinite(engine.headX.x) && Number.isFinite(engine.headY.x), "dragging pose should remain finite");

for (const state of allStates) {
  activeState = state;
  engine.setState(state);
  advance(300);
  const transform = nodes.transform.getAttribute("transform") || "";
  assert.ok(transform && !transform.includes("NaN"), `${state} should render a finite transform during sequential switching`);
  assert.ok((nodes.head.getAttribute("d") || "").startsWith("M"), `${state} should keep a valid head path`);
}
activeState = "idle";
engine.setState("idle");
advance(1000);
assert.ok(nodes.eyes.every((eye) => eye.style.display !== "none"), "eyes should remain visible after a full 39-state switch run");

assert.equal(Object.keys(SHAPES).length, 18, "the complete source shape catalog should contain 18 shapes");
for (const [shapeId, shape] of Object.entries(SHAPES)) {
  configs.idle = { ...baseConfig, shape: shapeId };
  activeState = "idle";
  engine.setState("idle", true);
  advance(1000 / 60);
  engine.spinSpring = null;
  engine.gesture = null;
  engine.shapeChangeWide = false;
  advance(1200);
  engine.morph.x = 0;
  engine.morph.v = 0;
  engine.morph.target = 0;
  engine.morphEffect = null;
  advance(1000 / 60);
  assert.equal(engine.shapeId, shapeId, `${shapeId} should become the active source shape`);
  assert.ok(engine.shapeBlend.x > 0.996, `${shapeId} should settle through the source shape spring`);
  assert.equal(nodes.head.getAttribute("d"), shape.path, `${shapeId} should finish on its exact source path`);
  assert.ok(nodes.eyes.every((eye) => eye.style.display !== "none"), `${shapeId} should keep both eyes visible after settling`);

  for (let eyeIndex = 0; eyeIndex < nodes.eyes.length; eyeIndex += 1) {
    const [translateX, translateY, scaleX, scaleY] = parseEyeTransform(nodes.eyes[eyeIndex].getAttribute("transform"));
    const ring = EXPRESSIONS[0][eyeIndex];
    const [centerX, centerY] = centroid(ring);
    for (const [x, y] of ring) {
      const transformedX = translateX + (x - centerX) * scaleX;
      const transformedY = translateY + (y - centerY) * scaleY;
      const [left, right] = spanAt(shape.ring, transformedY);
      assert.ok(transformedX >= left - 2 && transformedX <= right + 2, `${shapeId} eye ${eyeIndex} should stay inside the source silhouette`);
    }
  }
}

engine.destroy();
const slowestEyeReturn = Math.max(...eyeReturnTimes);
console.log(`Runtime transitions verified: all ${allStates.length} states and ${Object.keys(SHAPES).length} source shapes switch cleanly; eyes fit every silhouette; ${Object.keys(morphStates).length} morph states restore both eyes in <=${slowestEyeReturn.toFixed(1)}ms; direct morphs use independent layers; task cycles and orbit trails replay correctly.`);
