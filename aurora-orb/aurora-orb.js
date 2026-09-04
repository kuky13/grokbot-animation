import "../component/morph-bot.js";
import { STATE_CATALOG } from "../component/catalog.js";

export const FACIAL_STATE_IDS = Object.freeze([
  "idle",
  "sleeping",
  "waking",
  "listening",
  "thinking",
  "searching",
  "working",
  "excited",
  "surprised",
  "suspicious",
  "angry",
  "drowsy",
  "happy",
  "curious",
  "confused",
  "bored",
  "proud",
  "shy",
  "sad",
  "laughing",
  "scared",
  "playful",
  "celebrate",
]);

const labels = new Map(STATE_CATALOG.map((state) => [state.id, state]));
const bot = document.querySelector("#orb-face");
const canvas = document.querySelector("#gl");
const list = document.querySelector("#expression-list");
const currentZh = document.querySelector("#current-state-zh");
const currentEn = document.querySelector("#current-state-en");
const randomButton = document.querySelector("#random-state");
const autoplayButton = document.querySelector("#autoplay-state");
const responsiveButton = document.querySelector("#responsive-toggle");
const eyeSettings = document.querySelector("#eye-settings");
const eyePresetInput = document.querySelector("#eye-preset");
const eyeColorInput = document.querySelector("#eye-color");
const eyeOpacityInput = document.querySelector("#eye-opacity");
const eyeScaleInput = document.querySelector("#eye-scale");
const eyeBlendInput = document.querySelector("#eye-blend-mode");
const eyeColorValue = document.querySelector("#eye-color-value");
const eyeOpacityValue = document.querySelector("#eye-opacity-value");
const eyeScaleValue = document.querySelector("#eye-scale-value");
const resetEyeConfigButton = document.querySelector("#reset-eye-config");

const EYE_CONFIG_STORAGE_KEY = "aurora-orb-eye-config-v1";
const EYE_PRESETS = Object.freeze({
  "deep-glass": Object.freeze({ color: "#21356a", opacity: 90, scale: 92, blend: "luminosity" }),
  aurora: Object.freeze({ color: "#7654c7", opacity: 78, scale: 94, blend: "soft-light" }),
  pearl: Object.freeze({ color: "#bcecff", opacity: 72, scale: 90, blend: "screen" }),
  ink: Object.freeze({ color: "#090d22", opacity: 96, scale: 94, blend: "multiply" }),
});
const EYE_DEFAULT = Object.freeze({ preset: "deep-glass", ...EYE_PRESETS["deep-glass"] });

function loadEyeConfig() {
  try {
    const stored = JSON.parse(localStorage.getItem(EYE_CONFIG_STORAGE_KEY) || "null");
    if (!stored || typeof stored !== "object") return { ...EYE_DEFAULT };
    const validBlend = [...eyeBlendInput.options].some((option) => option.value === stored.blend);
    return {
      preset: typeof stored.preset === "string" ? stored.preset : "custom",
      color: /^#[0-9a-f]{6}$/i.test(stored.color) ? stored.color.toLowerCase() : EYE_DEFAULT.color,
      opacity: Math.min(100, Math.max(30, Number(stored.opacity) || EYE_DEFAULT.opacity)),
      scale: Math.min(120, Math.max(70, Number(stored.scale) || EYE_DEFAULT.scale)),
      blend: validBlend ? stored.blend : EYE_DEFAULT.blend,
    };
  } catch {
    return { ...EYE_DEFAULT };
  }
}

let eyeConfig = loadEyeConfig();

let selectedState = "idle";
let renderedState = "idle";
let autoplayTimer = 0;
let reactionTimer = 0;
let reactionToken = 0;
let responsive = true;
let pointerWasPressed = false;
let lastFastReaction = 0;

const buttons = FACIAL_STATE_IDS.map((id) => {
  const state = labels.get(id);
  const button = document.createElement("button");
  button.className = "expression-button";
  button.type = "button";
  button.dataset.state = id;
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(id === selectedState));
  button.innerHTML = `<strong>${state.zh}</strong><small>${state.en}</small>`;
  button.addEventListener("click", () => {
    stopAutoplay();
    chooseState(id, { focus: false });
  });
  list.append(button);
  return button;
});

bot.configure({
  character: {
    color: "transparent",
    eyeColor: "#21356a",
    pointer: true,
  },
  states: Object.fromEntries(FACIAL_STATE_IDS.map((id) => [id, { morph: "none" }])),
});

function installOrbEyeMaterial() {
  const svg = bot.shadowRoot?.querySelector("svg");
  const defs = svg?.querySelector("defs");
  if (!svg || !defs || defs.querySelector("#aurora-eye-depth")) return;

  const namespace = "http://www.w3.org/2000/svg";
  const gradient = document.createElementNS(namespace, "linearGradient");
  gradient.id = "aurora-eye-depth";
  gradient.setAttribute("x1", "0");
  gradient.setAttribute("y1", "0");
  gradient.setAttribute("x2", "0.22");
  gradient.setAttribute("y2", "1");
  gradient.innerHTML = `
    <stop data-eye-stop="highlight" offset="0" stop-color="#dff7ff" stop-opacity="0.62"></stop>
    <stop data-eye-stop="glint" offset="0.2" stop-color="#789bdb" stop-opacity="0.54"></stop>
    <stop data-eye-stop="body" offset="0.55" stop-color="#172c65" stop-opacity="0.82"></stop>
    <stop data-eye-stop="depth" offset="1" stop-color="#020612" stop-opacity="0.96"></stop>
  `;

  const filter = document.createElementNS(namespace, "filter");
  filter.id = "aurora-eye-softness";
  filter.setAttribute("x", "-30%");
  filter.setAttribute("y", "-30%");
  filter.setAttribute("width", "160%");
  filter.setAttribute("height", "170%");
  filter.innerHTML = `
    <feDropShadow dx="0" dy="1.4" stdDeviation="1.1" flood-color="#00020d" flood-opacity="0.72"></feDropShadow>
    <feDropShadow dx="0" dy="-0.45" stdDeviation="0.45" flood-color="#c9f4ff" flood-opacity="0.18"></feDropShadow>
  `;

  defs.append(gradient, filter);
  for (const eye of svg.querySelectorAll(".eye-path")) {
    eye.style.setProperty("fill", "url(#aurora-eye-depth)", "important");
    eye.style.setProperty("filter", "url(#aurora-eye-softness)");
  }
  applyEyeConfig({ persist: false });
}

installOrbEyeMaterial();
bot.addEventListener("ready", installOrbEyeMaterial, { once: true });

function mixHex(source, target, amount) {
  const parse = (hex) => [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
  const from = parse(source);
  const to = parse(target);
  return `#${from.map((channel, index) => Math.round(channel + (to[index] - channel) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function applyEyeConfig({ persist = true } = {}) {
  const gradient = bot.shadowRoot?.querySelector("#aurora-eye-depth");
  if (gradient) {
    gradient.querySelector('[data-eye-stop="highlight"]')?.setAttribute("stop-color", mixHex(eyeConfig.color, "#ffffff", 0.72));
    gradient.querySelector('[data-eye-stop="glint"]')?.setAttribute("stop-color", mixHex(eyeConfig.color, "#c9f4ff", 0.42));
    gradient.querySelector('[data-eye-stop="body"]')?.setAttribute("stop-color", eyeConfig.color);
    gradient.querySelector('[data-eye-stop="depth"]')?.setAttribute("stop-color", mixHex(eyeConfig.color, "#00020d", 0.88));
  }

  bot.setAttribute("eye-color", eyeConfig.color);
  bot.style.opacity = String(eyeConfig.opacity / 100);
  bot.style.mixBlendMode = eyeConfig.blend;
  syncBotSize();

  eyePresetInput.value = EYE_PRESETS[eyeConfig.preset] ? eyeConfig.preset : "custom";
  eyeColorInput.value = eyeConfig.color;
  eyeOpacityInput.value = String(eyeConfig.opacity);
  eyeScaleInput.value = String(eyeConfig.scale);
  eyeBlendInput.value = eyeConfig.blend;
  eyeColorValue.textContent = eyeConfig.color.toUpperCase();
  eyeOpacityValue.textContent = `${eyeConfig.opacity}%`;
  eyeScaleValue.textContent = `${eyeConfig.scale}%`;

  if (persist) {
    try { localStorage.setItem(EYE_CONFIG_STORAGE_KEY, JSON.stringify(eyeConfig)); } catch { /* storage can be disabled */ }
  }
}

function markEyeConfigCustom() {
  eyeConfig.preset = "custom";
  eyePresetInput.value = "custom";
}

function applyRenderedState(id, { replay = false } = {}) {
  if (renderedState === id && !replay) return;
  renderedState = id;
  bot.setState(id, { replay });
}

function chooseState(id, { focus = false } = {}) {
  if (!FACIAL_STATE_IDS.includes(id)) return;
  selectedState = id;
  clearTimeout(reactionTimer);
  reactionToken += 1;
  applyRenderedState(id, { replay: true });

  const state = labels.get(id);
  currentZh.textContent = state.zh;
  currentEn.textContent = state.en;
  bot.setAttribute("label", `Aurora Orb，${state.zh}`);

  for (const button of buttons) {
    const active = button.dataset.state === id;
    button.setAttribute("aria-selected", String(active));
    if (active) {
      button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      if (focus) button.focus();
    }
  }
}

function reactWith(id, duration) {
  if (!responsive || renderedState === id) return;
  const token = ++reactionToken;
  applyRenderedState(id, { replay: true });
  clearTimeout(reactionTimer);
  reactionTimer = window.setTimeout(() => {
    if (token === reactionToken) applyRenderedState(selectedState, { replay: true });
  }, duration);
}

function randomState() {
  const choices = FACIAL_STATE_IDS.filter((id) => id !== selectedState);
  chooseState(choices[Math.floor(Math.random() * choices.length)]);
}

function stopAutoplay() {
  clearInterval(autoplayTimer);
  autoplayTimer = 0;
  autoplayButton.classList.remove("is-on");
  autoplayButton.setAttribute("aria-pressed", "false");
  autoplayButton.querySelector("span").textContent = "关";
}

function startAutoplay() {
  stopAutoplay();
  autoplayButton.classList.add("is-on");
  autoplayButton.setAttribute("aria-pressed", "true");
  autoplayButton.querySelector("span").textContent = "开";
  autoplayTimer = window.setInterval(randomState, 3200);
}

function syncBotSize() {
  const orbDiameter = Math.min(window.innerWidth, window.innerHeight) * 0.602;
  bot.size = Math.round(orbDiameter * (259 / 228.541) * (eyeConfig.scale / 100));
}

randomButton.addEventListener("click", () => {
  stopAutoplay();
  randomState();
});

autoplayButton.addEventListener("click", () => {
  if (autoplayTimer) stopAutoplay();
  else startAutoplay();
});

responsiveButton.addEventListener("click", () => {
  responsive = !responsive;
  responsiveButton.classList.toggle("is-on", responsive);
  responsiveButton.setAttribute("aria-pressed", String(responsive));
  responsiveButton.querySelector("span").textContent = responsive ? "开" : "关";
  if (!responsive) {
    reactionToken += 1;
    clearTimeout(reactionTimer);
    applyRenderedState(selectedState, { replay: true });
    bot.style.setProperty("--face-shift-x", "0px");
    bot.style.setProperty("--face-shift-y", "0px");
    bot.style.setProperty("--face-tilt", "0deg");
  }
});

eyePresetInput.addEventListener("change", () => {
  const preset = EYE_PRESETS[eyePresetInput.value];
  if (!preset) return;
  eyeConfig = { preset: eyePresetInput.value, ...preset };
  applyEyeConfig();
});

eyeColorInput.addEventListener("input", () => {
  eyeConfig.color = eyeColorInput.value.toLowerCase();
  markEyeConfigCustom();
  applyEyeConfig();
});

eyeOpacityInput.addEventListener("input", () => {
  eyeConfig.opacity = Number(eyeOpacityInput.value);
  markEyeConfigCustom();
  applyEyeConfig();
});

eyeScaleInput.addEventListener("input", () => {
  eyeConfig.scale = Number(eyeScaleInput.value);
  markEyeConfigCustom();
  applyEyeConfig();
});

eyeBlendInput.addEventListener("change", () => {
  eyeConfig.blend = eyeBlendInput.value;
  markEyeConfigCustom();
  applyEyeConfig();
});

resetEyeConfigButton.addEventListener("click", () => {
  eyeConfig = { ...EYE_DEFAULT };
  applyEyeConfig();
});

document.addEventListener("pointerdown", (event) => {
  if (eyeSettings.open && !eyeSettings.contains(event.target)) eyeSettings.open = false;
});

eyeSettings.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    eyeSettings.open = false;
    eyeSettings.querySelector("summary")?.focus();
  }
});

list.addEventListener("keydown", (event) => {
  const currentIndex = buttons.indexOf(document.activeElement);
  if (currentIndex < 0) return;
  let nextIndex = currentIndex;
  if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % buttons.length;
  else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = buttons.length - 1;
  else return;
  event.preventDefault();
  stopAutoplay();
  chooseState(buttons[nextIndex].dataset.state, { focus: true });
});

window.addEventListener("aurora-pointer", (event) => {
  if (!responsive) return;
  const { x, y, speed, pressed, active, inside } = event.detail;
  const clampedX = Math.max(-1, Math.min(1, x));
  const clampedY = Math.max(-1, Math.min(1, y));
  const strength = active && inside ? 1 : 0;
  bot.style.setProperty("--face-shift-x", `${(clampedX * 6 * strength).toFixed(2)}px`);
  bot.style.setProperty("--face-shift-y", `${(clampedY * 4 * strength).toFixed(2)}px`);
  bot.style.setProperty("--face-tilt", `${(clampedX * 1.35 * strength).toFixed(2)}deg`);

  if (pressed && !pointerWasPressed && inside) reactWith("surprised", 760);
  pointerWasPressed = pressed;

  const now = performance.now();
  if (!pressed && inside && speed > 0.72 && now - lastFastReaction > 1450) {
    lastFastReaction = now;
    reactWith("curious", 680);
  }
});

canvas.addEventListener("pointerleave", () => {
  bot.style.setProperty("--face-shift-x", "0px");
  bot.style.setProperty("--face-shift-y", "0px");
  bot.style.setProperty("--face-tilt", "0deg");
  pointerWasPressed = false;
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) bot.pause();
  else bot.play();
});

window.addEventListener("resize", syncBotSize, { passive: true });
syncBotSize();
chooseState("idle");
