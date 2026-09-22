import { clamp, FIXED_STEP, springValue, stepSpring, smoothstep } from "./math.js";
import { resolveMaterial } from "../materials.js";

let visualId = 0;
function svgNode(tag, attrs = {}) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

const OPEN_STATES = new Set(["excited", "celebrate", "laughing", "surprised", "scared"]);
const SAD_STATES = new Set(["sad", "drowsy", "sleeping", "powering-down", "bored"]);
const FOCUSED_STATES = new Set(["thinking", "searching", "working", "loading", "progress", "writing", "sending", "receiving", "uploading"]);

export function bindDrippyCharacter(engine) {
  engine.drippySprings = {};
  engine.dotEyes = [...engine.svg.querySelectorAll(".drippy-eye")];
  engine.drippyEars = [...engine.svg.querySelectorAll(".drippy-ear")];
  engine.drippyMouth = engine.svg.querySelector(".drippy-mouth");
  engine.drippyMouthOpen = engine.svg.querySelector(".drippy-mouth-open");
  const gradientId = `drippy-halo-${++visualId}`;
  engine.haloGradient = svgNode("linearGradient", { id: gradientId, gradientUnits: "userSpaceOnUse", x1: 0, y1: 0, x2: 228.54, y2: 228.54 });
  engine.haloStops = [0, 0.5, 1].map(offset => {
    const stop = svgNode("stop", { offset });
    engine.haloGradient.appendChild(stop);
    return stop;
  });
  engine.transformGroup.appendChild(engine.haloGradient);
  engine.halo = svgNode("path", { class: "drippy-halo", fill: "none", stroke: `url(#${gradientId})`, "stroke-width": 3, "pointer-events": "none" });
  engine.halo.style.filter = "drop-shadow(0 0 3px var(--fg))";
  engine.transformGroup.appendChild(engine.halo);
  engine.haloAngle = 0;
  engine.happyEyes = engine.dotEyes.map(() => {
    const path = svgNode("path", { fill: "none", stroke: "var(--bg)", "stroke-width": 3.5, "stroke-linecap": "round" });
    engine.transformGroup.appendChild(path);
    return path;
  });
  engine.adornments = [0, 1, 2].map(() => {
    const text = svgNode("text", { fill: "var(--fg)", "font-family": "system-ui", "font-size": 13, "text-anchor": "middle", "pointer-events": "none" });
    engine.transformGroup.appendChild(text);
    return text;
  });
}

export function renderDrippyCharacter(engine, now, reducedMotion = false) {
  // Use the simulation delta so pause, stepping and playback speed stay exact.
  const settle = (key, target, frequency = 16, damping = 0.85) => {
    const spring = engine.drippySprings[key] ??= springValue(target);
    spring.target = target;
    const delta = engine.delta ?? 0;
    if (reducedMotion) { spring.x = target; spring.v = 0; }
    else {
      const steps = Math.max(1, Math.ceil(delta / FIXED_STEP));
      for (let i = 0; i < steps; i++) stepSpring(spring, frequency, damping, delta / steps);
    }
    return spring.x;
  };
  const state = engine.state;
  const config = engine.getConfig?.() || {};
  const phase = reducedMotion ? 0 : now * 0.001;
  const motion = reducedMotion ? 0 : 1;
  const fade = clamp(1 - Math.max(0, engine.morph?.x || 0) * 2.25, 0, 1);
  const source = engine.internalSpeech || engine.externalSpeech;
  const hasSpeech = Boolean(source) || engine.manualSpeech != null;
  const speechTarget = engine.paused ? 0 : clamp(source ? source() : (engine.manualSpeech ?? 0), 0, 1);
  engine.speechLevel = clamp(settle("speechLevel", speechTarget, speechTarget > (engine.speechLevel || 0) ? 35 : 18, 1), 0, 1);
  const speaking = hasSpeech ? engine.speechLevel : state === "dictating" ? 0.35 : 0;
  const haloSpeed = settle("haloSpeed", 45 + 135 * Math.min(1, speaking * 3), 8, 1);
  engine.haloAngle = (engine.haloAngle + (engine.delta || 0) * haloSpeed * motion) % 360;
  engine.haloGradient.setAttribute("gradientTransform", `rotate(${reducedMotion ? 0 : engine.haloAngle} 114.27 114.27)`);
  const material = resolveMaterial(config);
  const stops = material.stops || [{ color: material.color || config.color || "#777" }];
  engine.haloStops.forEach((stop, index) => {
    stop.setAttribute("stop-color", stops[Math.round(index * (stops.length - 1) / 2)].color);
    stop.setAttribute("stop-opacity", index === 1 ? 0.25 : 1);
  });
  engine.halo.setAttribute("d", engine.head.getAttribute("d") || "");
  engine.halo.setAttribute("transform", "translate(114.27 114.27) scale(1.025) translate(-114.27 -114.27)");
  engine.halo.style.opacity = String(config.halo === "off" ? 0 : fade * (0.5 + 0.16 * Math.sin(phase * 2) + speaking * 0.3));
  engine.adornments.forEach((node, index) => {
    const thinking = state === "thinking", happy = ["happy", "celebrate"].includes(state), sleepy = ["sleeping", "drowsy"].includes(state);
    const cycle = (phase * 0.45 + index / 3) % 1;
    node.textContent = thinking ? "●" : happy ? "✦" : index % 2 ? "Z" : "z";
    node.setAttribute("x", thinking ? 158 + index * 10 : 25 + index * 90);
    node.setAttribute("y", thinking ? 38 : sleepy ? 45 - cycle * 24 : 42 + (index % 2) * 125);
    node.style.opacity = String(fade * (thinking ? 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(phase * 4 - index)) : happy || sleepy ? (reducedMotion ? 0.6 : Math.sin(cycle * Math.PI)) : 0));
  });

  // Drippy keeps a deliberately simple face: two centered points. We preserve
  // the runtime blink/gaze springs, but never morph the dots into Grok eye shapes.
  if (engine.dotEyes?.length === 2) {
    const config = engine.getConfig?.() || {};
    const autonomousWeight = config.pointer && engine.pointer?.active ? 0.22 : 1;
    const gazeX = settle("gazeX", clamp((engine.pointer?.x || 0) + (engine.aimX?.x || 0) * autonomousWeight + (engine.directGazeX || 0), -5.5, 5.5), 18, 1);
    const gazeY = settle("gazeY", clamp((engine.pointer?.y || 0) + (engine.aimY?.x || 0) * autonomousWeight + (engine.directGazeY || 0), -4, 4), 18, 1);
    const eyeScale = clamp(engine.eyeScale?.x ?? 1, 0.82, 1.28);
    const baseX = [78, 150.54];
    const sleepOpen = settle("sleepOpen", state === "sleeping" ? 0.07 : state === "drowsy" ? 0.35 : state === "angry" ? 0.55 : 1, 16, 1);
    const joy = settle("joyEyes", ["happy", "laughing", "celebrate"].includes(state) ? 1 : 0, 16, 1);
    for (let index = 0; index < engine.dotEyes.length; index += 1) {
      let winkScale = 1;
      if (!reducedMotion && index === engine.winkEye && now >= engine.winkAt && now < engine.winkAt + 320) {
        const winkPhase = (now - engine.winkAt) / 320;
        winkScale = 0.06 + 0.94 * (winkPhase < 0.32 ? 1 - smoothstep(winkPhase / 0.32) : smoothstep((winkPhase - 0.32) / 0.68));
      }
      const open = clamp((Math.min(sleepOpen, engine.eyeOpen?.x ?? 1)) * winkScale, 0.12, 1.08);
      const radius = 7 * eyeScale * settle(`eyeAsymmetry${index}`, state === "confused" ? (index === 0 ? 0.8 : 1.15) : 1);
      const eye = engine.dotEyes[index];
      eye.setAttribute("cx", (baseX[index] + gazeX).toFixed(2));
      eye.setAttribute("cy", (108 + gazeY).toFixed(2));
      eye.setAttribute("rx", radius.toFixed(2));
      eye.setAttribute("ry", (radius * open).toFixed(2));
      eye.style.opacity = String(fade * (1 - joy));
      eye.style.display = fade > 0.03 ? "" : "none";
      const arc = engine.happyEyes[index];
      const x = baseX[index] + gazeX, y = 108 + gazeY;
      arc.setAttribute("d", `M ${x - radius} ${y + 2} Q ${x} ${y + 2 - 13 * open} ${x + radius} ${y + 2}`);
      arc.style.opacity = String(fade * joy);
    }
  }

  if (engine.drippyEars?.length === 2) {
    let left = 0, right = 0, lift = 0, height = 9;
    const breath = Math.sin(phase * 1.5) * 0.5 * motion;
    if (state === "listening") { lift = -3; height = 11; left = Math.sin(phase * 2.5) * motion; right = Math.sin(phase * 2.5 + 1.1) * motion; }
    else if (["curious", "confused", "thinking"].includes(state)) {
      left = 5; right = -2; height = 8;
      if (state === "confused") [left, right] = [right, left];
    } else if (["happy", "excited", "celebrate", "playful", "laughing"].includes(state)) {
      lift = -2; height = 11;
      left = Math.sin(phase * 5) * 1.5 * motion;
      right = Math.sin(phase * 5 + 0.7) * 1.5 * motion;
    } else if (["surprised", "scared", "alerting"].includes(state)) { lift = -5; height = 12; }
    else if (["angry", "suspicious"].includes(state)) { left = 3; right = state === "suspicious" ? -3 : 3; height = 5; }
    else if (SAD_STATES.has(state)) { lift = 5; height = 3; }
    else if (FOCUSED_STATES.has(state)) { left = 2; right = -1; height = 7; }
    const inertia = clamp(-(engine.headY?.v ?? 0) * 0.018, -1.5, 1.5) * motion;
    for (const [index, ear] of engine.drippyEars.entries()) {
      const x = index === 0 ? 78 : 150.54;
      const offset = index === 0 ? left : right;
      const y = settle(`earY${index}`, 78 + lift + offset + breath + inertia);
      const h = settle(`earH${index}`, height - Math.max(0, offset) * 0.65);
      const lean = settle(`earLean${index}`, offset * (index === 0 ? 0.55 : -0.55));
      ear.setAttribute("d", `M ${x - 5} ${y.toFixed(2)} Q ${x - 2 + lean} ${(y - h * 0.72).toFixed(2)} ${x + lean} ${(y - h).toFixed(2)} Q ${x + 2 + lean} ${(y - h * 0.72).toFixed(2)} ${x + 5} ${y.toFixed(2)}`);
      ear.style.opacity = String(fade);
    }
  }

  if (!engine.drippyMouth || !engine.drippyMouthOpen) return;

  const cx = 114.27;
  let y = 149;
  let width = 18;
  let curve = 8;
  let tilt = 0;
  let open = 0;

  if (SAD_STATES.has(state)) {
    y = 153;
    width = 15;
    curve = -7.5;
  } else if (["angry", "suspicious"].includes(state)) {
    width = 16;
    curve = -1.5;
    tilt = state === "suspicious" ? -5 : 0;
  } else if (["curious", "confused"].includes(state)) {
    width = 14;
    curve = 3;
    tilt = state === "curious" ? -5 : 5;
  } else if (state === "thinking") {
    width = 13 + Math.sin(phase * 2.2) * 1.5;
    curve = 2.5;
    tilt = -3;
  } else if (["happy", "proud", "playful"].includes(state)) {
    width = 19;
    curve = 10 + Math.sin(phase * 3.0) * 1.2;
  } else if (OPEN_STATES.has(state)) {
    open = state === "surprised" || state === "scared" ? 1 : 0.78 + Math.abs(Math.sin(phase * 7.2)) * 0.22;
  } else if (state === "dictating") {
    open = 0.35 + Math.abs(Math.sin(phase * 9.5)) * 0.65;
  } else if (["loading", "working", "searching", "writing", "sending", "receiving", "uploading", "humming", "progress"].includes(state)) {
    width = 15 + Math.sin(phase * 2.2) * 0.6;
    curve = 4 + Math.sin(phase * 1.8) * 0.6;
  } else if (state === "listening") {
    width = 16;
    curve = 6 + Math.sin(phase * 3.8) * 1.4;
  } else {
    width += Math.sin(phase * 1.8) * 0.9;
    curve += Math.sin(phase * 1.7 + 0.4) * 0.8;
  }

  if (hasSpeech) open = engine.paused ? 0 : engine.speechLevel;
  y = settle("mouthY", y);
  width = settle("mouthWidth", width);
  curve = settle("mouthCurve", curve);
  tilt = settle("mouthTilt", tilt);
  open = clamp(settle("mouthOpen", open, 22, 1), 0, 1);

  const lineOpacity = fade * (1 - clamp(open * 1.35, 0, 1));
  engine.drippyMouth.setAttribute("d", `M ${(cx - width).toFixed(2)} ${y.toFixed(2)} Q ${cx.toFixed(2)} ${(y + curve).toFixed(2)} ${(cx + width).toFixed(2)} ${y.toFixed(2)}`);
  engine.drippyMouth.setAttribute("transform", `rotate(${tilt.toFixed(2)} ${cx} ${y})`);
  engine.drippyMouth.style.opacity = lineOpacity.toFixed(3);

  const openPulse = clamp(open, 0, 1);
  engine.drippyMouthOpen.setAttribute("cx", String(cx));
  engine.drippyMouthOpen.setAttribute("cy", String(y + 3));
  const round = /[ouɔʊ]/i.test(engine.speechPhoneme || "");
  const mouthRadius = settle("mouthRadius", hasSpeech ? (round ? 5 : 9) : ["excited", "laughing", "celebrate"].includes(state) ? 14 : 7.5);
  engine.drippyMouthOpen.setAttribute("rx", (mouthRadius * (0.7 + openPulse * 0.3)).toFixed(2));
  engine.drippyMouthOpen.setAttribute("ry", (2.0 + openPulse * 6.0).toFixed(2));
  engine.drippyMouthOpen.style.opacity = (fade * clamp(open * 1.4, 0, 1)).toFixed(3);
}
