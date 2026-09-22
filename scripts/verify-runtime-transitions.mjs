import assert from "node:assert/strict";

let clock = 0;
globalThis.performance = { now: () => clock };
let randomSeed = 0x5f3759df;
const seededRandom = () => {
  randomSeed = (1664525 * randomSeed + 1013904223) >>> 0;
  return randomSeed / 0x100000000;
};
Math.random = seededRandom;

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
  append(...children) { this.children.push(...children); }
  appendChild(child) { this.children.push(child); return child; }
  insertBefore(child) { this.children.push(child); return child; }
  remove() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 390, height: 390 }; }
}

const nodes = {
  dotEyes: [new FakeElement(), new FakeElement()],
  ears: [new FakeElement(), new FakeElement()],
  mouth: new FakeElement(),
  mouthOpen: new FakeElement(),
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
  ".drippy-mouth": nodes.mouth,
  ".drippy-mouth-open": nodes.mouthOpen,
  "#head-path": nodes.head,
  "#head-clip-path": nodes.clip,
  "#bot-transform": nodes.transform,
  "#notify-badge": nodes.badge,
  "#particles-back": nodes.particlesBack,
  "#particles-front": nodes.particlesFront,
})[selector];
svg.querySelectorAll = (selector) => ({
  ".drippy-eye": nodes.dotEyes,
  ".drippy-ear": nodes.ears,
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

Object.assign(baseConfig, { material: "gradient", gradientPreset: "ocean-signal" });
engine.frame(clock);
assert.match(svg.style["--fg"], /^url\(#.+-material-gradient\)$/, "gradient material should become the shared SVG paint");
assert.ok(engine.materials.gradient.children.length > 3, "gradient presets should expand into perceptually smoothed intermediate stops");
assert.equal(engine.materials.gradient.getAttribute("color-interpolation"), "sRGB", "densely sampled gradients should use short sRGB interpolation segments");
assert.equal(engine.materials.gradientOverlayGroup.hidden, false, "gradient materials should add soft volume lighting");
assert.equal(engine.materials.gradientLightPath.getAttribute("d"), nodes.head.getAttribute("d"), "gradient lighting should follow the current shape path");

Object.assign(baseConfig, { material: "rainbow-glass", glassPreset: "iridescent-orb" });
engine.materials.apply(baseConfig);
engine.directRotation = 31;
const rotatedGlass = engine.render(clock, baseConfig);
engine.materials.syncHeadPath(rotatedGlass.headPath, rotatedGlass.rotation);
assert.equal(engine.materials.overlayGroup.hidden, false, "rainbow glass should enable its shading layers");
assert.equal(engine.materials.sheenPath.getAttribute("d"), nodes.head.getAttribute("d"), "glass highlights should follow the current shape path");
assert.equal(engine.materials.causticPath.getAttribute("d"), nodes.head.getAttribute("d"), "glass caustics should follow the current shape path");
assert.equal(engine.materials.causticRing, undefined, "glass should not draw a hard internal reflection ring");
assert.equal(engine.materials.rimPath.getAttribute("stroke-width"), "1.35", "glass rim should remain fine rather than reading as a neon outline");
assert.match(nodes.transform.getAttribute("transform"), /rotate\(31\.00\)/, "the shape itself should retain its visual rotation");
for (const gradient of [engine.materials.glass, engine.materials.shadow, engine.materials.caustic, engine.materials.sheen, engine.materials.rim]) {
  assert.equal(gradient.getAttribute("gradientTransform"), `rotate(-31.000 ${HEAD_C} ${HEAD_C})`, "glass lighting should counter-rotate around the same center as the shape");
  assert.equal(gradient.getAttribute("gradientUnits"), "userSpaceOnUse", "glass lighting should use a stable shared coordinate system");
}

Object.assign(baseConfig, { material: "solid", color: "#0b0b0b" });
engine.directRotation = 0;
engine.frame(clock);
assert.equal(svg.style["--fg"], "#0b0b0b", "solid material should remain backwards compatible with color");
assert.equal(engine.materials.overlayGroup.hidden, true, "solid material should remove glass shading layers");
assert.equal(engine.materials.gradientOverlayGroup.hidden, true, "solid material should remove gradient lighting layers");

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

activeState = "waking";
engine.setState("waking", true);
engine.wakeBurst = true;
engine.blinkQueue = [];
engine.blinkTarget = null;
engine.updateStateTargets(engine.stateStartedAt + 1250, configs.waking, 1 / 60);
assert.ok(engine.blinkQueue.length > 0, "waking should schedule the source recovery blink between 1.2s and 1.4s");

activeState = "celebrate";
engine.setState("celebrate", true);
const particlesBeforeCelebrate = engine.particles.particles.length;
const celebratePose = engine.celebratePose(4.25);
assert.notEqual(celebratePose.gazeX, 0, "celebrate should include the source horizontal eye shake");
assert.notEqual(celebratePose.gazeY, 0, "celebrate should include the source vertical eye shake");
assert.equal(engine.particles.particles.length, particlesBeforeCelebrate, "celebrate should not inject an extra non-source particle burst");
assert.equal(engine.celebrateWildActive, true, "celebrate wide particles should only be active during the wild phase");
engine.celebratePose(5.9);
assert.equal(engine.celebrateWildActive, false, "celebrate should leave wide particle styling during its source rest phase");

activeState = "idle";
engine.setState("idle", true);
engine.expressionCursor = 0;
engine.expressionNext = engine.clockTime;
Math.random = () => 0.5;
engine.updateExpressionAndBlink(engine.clockTime, {
  ...configs.idle,
  expressionPool: [0, 1, 2],
  expressionWeights: { 1: 20, 2: 0.1 },
});
assert.equal(engine.expressionIndex, 1, "custom expression weights should select from the ordered pool without repeating the current pose");
Math.random = seededRandom;

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

for (let seconds = 0; seconds < 12; seconds += 0.1) {
  const sleepy = sampleDrowsy(seconds);
  assert.ok(sleepy.y >= 3.8 && sleepy.y <= 8.2, "drowsy breathing stays shallow without a large drop");
  assert.ok(Math.abs(sleepy.rotation) <= 2.5, "drowsy keeps a gentle tilt");
  assert.ok(sleepy.eyeOpen < 0.5, "drowsy eyes remain sleepy");
}

engine.pointer.active = false;

engine.pointer.active = true;
engine.pointer.clientX = 390;
engine.pointer.clientY = 195;
engine.pointer.x = 0;
engine.pointer.y = 0;
engine.aimX.x = 0;
engine.aimY.x = 0;
engine.directGazeX = 0;
engine.directGazeY = 0;
engine.delta = 1 / 60;
engine.renderEyes(drowsyStart + 900, { ...configs.drowsy, pointer: true }, SHAPES.blob, SHAPES.blob.ring, 0, 0);
near(engine.pointer.x, 11 * (1 - 0.91 ** 2), 0.0001, "pointer smoothing should advance once per eye like the source loop");
engine.pointer.active = false;
engine.pointer.x = 0;
engine.pointer.y = 0;

engine.morphEffect = "bang";
engine.previousMorphEffect = null;
engine.stateStartedAt = clock;
const halfBangPose = engine.renderMorphEffects(0.5, 1, null, 1, clock);
near(halfBangPose.y, 14.5, 0.0001, "morph pose displacement should apply the source quadratic morph amount");
engine.morphEffect = null;
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

activeState = "thinking";
engine.setState("thinking", true);
advance(700);
assert.ok(engine.morph.x > 0.996, "thinking should begin from its persistent source morph");
assert.equal(engine.triggerMorphPreview("dots", 500), true, "a valid morph should start a single-shot preview");
const previewPhases = new Set([engine.getSnapshot().morphPhase]);
for (let frame = 0; frame < 240 && engine.getSnapshot().morphPhase !== "DONE"; frame += 1) {
  advance(1000 / 60);
  previewPhases.add(engine.getSnapshot().morphPhase);
}
for (const phase of ["RESET", "ENTER", "HOLD", "EXIT", "DONE"]) {
  assert.ok(previewPhases.has(phase), `single-shot morph should pass through ${phase}`);
}
assert.ok(engine.morph.x < 0.004, "single-shot morph should settle back on the bot");
assert.equal(engine.morphEffect, null, "single-shot morph should release its effect after exit");
advance(1000);
assert.equal(engine.getSnapshot().morphPhase, "DONE", "single-shot morph should remain on the bot instead of silently retriggering");
engine.clearMorphPreview();
advance(700);
assert.ok(engine.morph.x > 0.996, "restoring the state default should re-enter thinking's persistent morph");
assert.equal(engine.getSnapshot().morphPhase, "HOLD", "restored persistent morph should report HOLD");

for (const from of allStates) {
  activeState = from;
  engine.setState(from, true);
  advance(50);
  for (const to of allStates) {
    activeState = to;
    engine.setState(to, true);
    advance(80);
    const transform = nodes.transform.getAttribute("transform") || "";
    assert.ok(transform && !transform.includes("NaN"), `${from} -> ${to} should keep a finite transform`);
    assert.ok((nodes.head.getAttribute("d") || "").startsWith("M"), `${from} -> ${to} should preserve the head geometry`);
  }
}

activeState = "idle";
engine.setState("idle", true);
engine.setPaused(true);
const pausedClock = engine.clockTime;
advance(200);
near(engine.clockTime, pausedClock, 0.0001, "pause should freeze the simulation clock");
engine.stepFrame();
advance(1000 / 60);
near(engine.clockTime, pausedClock + 1000 / 60, 0.0001, "step should advance exactly one source frame");
engine.setPlaybackRate(2);
engine.setPaused(false);
advance(1000 / 60);
near(engine.clockTime, pausedClock + 3 * 1000 / 60, 0.0001, "2x playback should advance the simulation clock at double speed");
engine.setPlaybackRate(1);

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

  for (const eye of nodes.dotEyes) {
    const x = Number(eye.getAttribute("cx"));
    const y = Number(eye.getAttribute("cy"));
    const rx = Number(eye.getAttribute("rx"));
    const ry = Number(eye.getAttribute("ry"));
    for (const edgeY of [y - ry, y, y + ry]) {
      const [left, right] = spanAt(shape.ring, edgeY);
      assert.ok(x - rx >= left && x + rx <= right, `${shapeId} keeps Drippy dot eyes inside its silhouette`);
    }
  }

  for (let expressionIndex = 0; expressionIndex < EXPRESSIONS.length; expressionIndex += 1) {
    engine.expressionFrom = EXPRESSIONS[expressionIndex];
    engine.expressionTo = EXPRESSIONS[expressionIndex];
    engine.expressionIndex = expressionIndex;
    engine.expressionSpring.x = 1;
    for (const eyeOpen of [0.08, 0.34, 1, 1.14]) {
      engine.eyeOpen.x = eyeOpen;
      engine.eyeScale.x = 1;
      engine.renderEyes(clock, configs.idle, shape, shape.ring, 0, 0);
      for (let eyeIndex = 0; eyeIndex < nodes.eyes.length; eyeIndex += 1) {
        const [translateX, translateY, scaleX, scaleY] = parseEyeTransform(nodes.eyes[eyeIndex].getAttribute("transform"));
        const ring = EXPRESSIONS[expressionIndex][eyeIndex];
        const [centerX, centerY] = centroid(ring);
        for (const [x, y] of ring) {
          const transformedX = translateX + (x - centerX) * scaleX;
          const transformedY = translateY + (y - centerY) * scaleY;
          const [left, right] = spanAt(shape.ring, transformedY);
          assert.ok(transformedX >= left - 2 && transformedX <= right + 2, `${shapeId} E${expressionIndex} eye ${eyeIndex} should stay inside the source silhouette at ${eyeOpen} open`);
        }
      }
    }
  }
}

// Exercise the visible face, not just the original hidden eye geometry.
const { renderDrippyCharacter } = await import("../component/runtime/drippy-character.js");
engine.state = "idle";
engine.delta = 1 / 60;
engine.reactionAt = -Infinity;
engine.morph.x = 0;
engine.eyeOpen.x = 1;
engine.winkAt = 1000;
for (const side of [0, 1]) {
  engine.winkEye = side;
  renderDrippyCharacter(engine, 1102.4);
  assert.ok(Number(nodes.dotEyes[side].getAttribute("ry")) < 1, "wink should close only the selected eye");
  assert.ok(Number(nodes.dotEyes[1 - side].getAttribute("ry")) > 5, "other eye stays open");
}
engine.winkAt = -Infinity;
engine.eyeOpen.x = 0;
renderDrippyCharacter(engine, 1500);
assert.ok(nodes.dotEyes.every(eye => Number(eye.getAttribute("ry")) < 1), "zero openness must not reopen eyes");
engine.eyeOpen.x = 1;
engine.blinkQueue = [];
engine.winkNext = 0;
const firstSide = engine.winkEye;
engine.updateGestures(2000);
assert.equal(engine.winkEye, 1 - firstSide, "successive winks alternate sides");
engine.scheduleBlink(2100);
assert.equal(engine.blinkQueue.length, 0, "blink cannot overlap wink");
engine.winkNext = 0;
engine.updateGestures(2500);
assert.equal(engine.winkEye, firstSide);
engine.winkAt = -Infinity;
engine.state = "idle";
renderDrippyCharacter(engine, 3000, true);
const initialY = engine.drippySprings.earY0.x;
engine.state = "curious";
renderDrippyCharacter(engine, 3000);
assert.ok(engine.drippySprings.earY0.x > initialY && engine.drippySprings.earY0.x < 83, "ear eases toward its new pose");
for (let i = 0; i < 120; i++) renderDrippyCharacter(engine, 3000 + i * 1000 / 60);
assert.ok(engine.drippySprings.earY0.x - engine.drippySprings.earY1.x > 6, "curious ears move independently");
engine.delta = 0;
const pausedFace = JSON.stringify([...nodes.ears, nodes.mouth].map(node => [...node.attributes]));
renderDrippyCharacter(engine, 3000 + 119 * 1000 / 60);
assert.equal(JSON.stringify([...nodes.ears, nodes.mouth].map(node => [...node.attributes])), pausedFace, "pause freezes face springs");
renderDrippyCharacter(engine, 6000, true);
const reducedFace = JSON.stringify([...nodes.ears, nodes.mouth].map(node => [...node.attributes]));
renderDrippyCharacter(engine, 8000, true);
assert.equal(JSON.stringify([...nodes.ears, nodes.mouth].map(node => [...node.attributes])), reducedFace, "reduced motion has no decorative oscillation");
engine.morph.x = 1;
renderDrippyCharacter(engine, 8000, true);
assert.ok([...nodes.dotEyes, ...nodes.ears, nodes.mouth, nodes.mouthOpen].every(node => Number(node.style.opacity) === 0), "morph hides the whole face");
console.log("Drippy verified: independent ears, both winks, blink exclusion, zero openness, easing, pause, reduced motion and morph fade.");
engine.morph.x = 0;
engine.spinSpring = engine.gesture = null;
engine.bounceStartedAt = -1;
engine.manualSpeech = null;
engine.internalSpeech = engine.externalSpeech = null;
for (const state of ["happy", "excited", "proud", "playful", "curious", "confused", "listening", "laughing", "celebrate"]) {
  engine.state = state;
  engine.reactionAt = -Infinity;
  engine.ambientNext = 0;
  engine.eyeOpen.x = 1;
  engine.winkAt = -Infinity;
  engine.winkNext = Infinity;
  engine.blinkQueue = [];
  engine.updateGestures(10000);
  assert.equal(engine.reactionAt, 10000, `${state} starts a short reaction`);
  assert.ok(engine.ambientNext >= 13700 && engine.ambientNext <= 17700, "reactions have 3–7 seconds of rest");
  engine.scheduleBlink(10200);
  assert.equal(engine.blinkQueue.length, 0, "reaction excludes blinking");
  engine.winkNext = 0;
  engine.updateGestures(10300);
  assert.equal(engine.winkAt, -Infinity, "reaction excludes winking");
  engine.updateStateTargets(10300, baseConfig, 1 / 60);
  assert.ok(Math.abs(engine.rotation.target) <= 5 * Math.PI / 180, `${state} keeps its body tilt subtle`);
  assert.equal(engine.spinSpring, null, `${state} never spins spontaneously`);
  assert.equal(engine.gesture, null, `${state} never starts a wild gesture`);
}
engine.state = "laughing";
engine.delta = 1 / 60;
for (let i = 0; i < 60; i++) renderDrippyCharacter(engine, 11000 + i * 1000 / 60);
assert.match(nodes.mouth.getAttribute("d"), / Q .* Q .* Z$/, "laughter uses a curved open smile");
assert.equal(Number(nodes.mouthOpen.style.opacity), 0, "laughter never displays the separate oval");
engine.state = "happy";
engine.reactionAt = -Infinity;
for (let i = 0; i < 120; i++) renderDrippyCharacter(engine, 13000 + i * 1000 / 60);
assert.ok(engine.happyEyes.every(eye => Number(eye.style.opacity) < 0.01), "happy returns to dot eyes between reactions");
assert.ok(nodes.dotEyes.every(eye => Number(eye.style.opacity) > 0.99), "happy dot eyes remain visible at rest");
console.log("Subtle expressions verified: bounded reactions, natural rests, blink/wink exclusion, no spontaneous spins and a curved laugh.");
engine.destroy();
const slowestEyeReturn = Math.max(...eyeReturnTimes);
console.log(`Runtime transitions verified: all ${allStates.length ** 2} ordered state pairs switch cleanly; all ${Object.keys(SHAPES).length * EXPRESSIONS.length * 4} shape/expression/open combinations fit; ${Object.keys(morphStates).length} morph states restore both eyes in <=${slowestEyeReturn.toFixed(1)}ms; source loops plus RESET/ENTER/HOLD/EXIT/DONE single shots pass.`);
