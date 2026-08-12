import { EXPRESSIONS, HEAD_C, ORIGINAL_STATE_DATA, SHAPES } from "./original-data.js";
import { GrokBotEngine } from "./grok-bot-engine.js";

const stateGroups = [
  { label: "Lifecycle · 基础状态", states: [["sleeping", "睡眠"], ["waking", "醒来"], ["idle", "待机"], ["listening", "倾听"], ["thinking", "思考"], ["searching", "搜索"], ["working", "工作"]] },
  { label: "Reactions · 情绪反应", states: [["excited", "兴奋"], ["surprised", "惊讶"], ["suspicious", "怀疑"], ["angry", "生气"], ["drowsy", "困倦"], ["happy", "开心"], ["curious", "好奇"], ["confused", "困惑"], ["bored", "无聊"], ["proud", "得意"], ["shy", "害羞"], ["sad", "难过"], ["laughing", "大笑"], ["scared", "害怕"], ["playful", "调皮"], ["celebrate", "庆祝"]] },
  { label: "Agent morphs · Agent 形变", states: [["orbit", "轨道"], ["radar", "雷达"], ["progress", "进度"]] },
  { label: "Product lifecycle · 任务状态", states: [["spawning", "生成"], ["humming", "运转"], ["loading", "加载"], ["dictating", "听写"], ["writing", "书写"], ["sending", "发送"], ["receiving", "接收"], ["uploading", "上传"], ["notifying", "通知"], ["alerting", "警报"], ["dragging", "拖拽"], ["bouncing", "弹跳"], ["powering-down", "关机"]] },
];

const states = stateGroups.flatMap((group) => group.states);
const stateIds = states.map(([id]) => id);
const stateLabels = Object.fromEntries(states);
const shapeLabels = {
  blob: "圆形", pebble: "卵石", bean: "豆形", egg: "蛋形", squircle: "圆角方形",
  tablet: "圆角矩形", capsule: "胶囊", cylinder: "圆柱", hex: "六边形", gem: "宝石",
  crystal: "水晶", wedge: "三角楔形", shield: "盾牌", dome: "拱顶", arch: "拱门",
  cloud: "云朵", teardrop: "水滴", leaf: "叶片",
};
const morphByState = {
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

function defaultState(id) {
  const blink = ORIGINAL_STATE_DATA.BLINK_CADENCE[id];
  return {
    color: "#0b0b0b",
    eyeColor: "#ffffff",
    size: 390,
    flipX: false,
    pointer: true,
    badgeColor: "#1d9bf0",
    badgeScale: 1,
    expressionPool: [...ORIGINAL_STATE_DATA.EXPRESSION_POOLS[id]],
    expressionCadence: [...ORIGINAL_STATE_DATA.EXPRESSION_CADENCE[id]],
    blinkEnabled: Boolean(blink),
    blinkMin: blink?.[0] ?? 3000,
    blinkMax: blink?.[1] ?? 7000,
    morph: morphByState[id] || "none",
    headX: 0,
    headY: 0,
    headRotation: 0,
    scaleX: 1,
    scaleY: 1,
    eyeOpen: 1,
    eyeScale: 1,
    gazeScale: 1,
    motionScale: 1,
    tempo: 1,
  };
}

function createDefaultProject() {
  return { version: 4, shape: "blob", states: Object.fromEntries(stateIds.map((id) => [id, defaultState(id)])) };
}

const defaultProject = createDefaultProject();
const storageKey = "grokbot-original-state-lab-v4";
const legacyStorageKey = "grokbot-original-state-lab-v3";

function normalizeProject(candidate) {
  const normalized = createDefaultProject();
  if (!candidate?.states) return normalized;
  const requestedShape = candidate.shape ?? candidate.states.idle?.shape;
  if (SHAPES[requestedShape]) normalized.shape = requestedShape;
  for (const id of stateIds) {
    const incoming = candidate.states[id];
    if (!incoming) continue;
    const { shape: _legacyStateShape, ...incomingState } = incoming;
    normalized.states[id] = { ...normalized.states[id], ...incomingState };
    normalized.states[id].expressionPool = Array.isArray(incoming.expressionPool)
      ? incoming.expressionPool.filter((value) => Number.isInteger(value) && value >= 0 && value < EXPRESSIONS.length)
      : normalized.states[id].expressionPool;
    if (!normalized.states[id].expressionPool.length) normalized.states[id].expressionPool = [...defaultProject.states[id].expressionPool];
    normalized.states[id].expressionCadence = Array.isArray(incoming.expressionCadence)
      ? incoming.expressionCadence.slice(0, 2).map(Number)
      : normalized.states[id].expressionCadence;
  }
  return normalized;
}

function loadProject() {
  try {
    const stored = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyStorageKey);
    return normalizeProject(JSON.parse(stored));
  }
  catch { return createDefaultProject(); }
}

let project = loadProject();
let activeState = location.hash.slice(1);
if (!stateIds.includes(activeState)) activeState = "idle";
let autoplayTimer = null;
let autoplayIndex = 0;
let editHistory = [JSON.stringify(project)];
let historyIndex = 0;

const autoplaySequence = ["idle", "curious", "listening", "thinking", "searching", "working", "happy", "playful", "surprised", "celebrate", "orbit", "radar", "progress", "dictating", "writing", "sending", "receiving", "uploading", "notifying", "alerting", "bouncing", "drowsy", "sleeping", "waking"];

const svg = document.querySelector("#grok-bot");
const stage = document.querySelector("#bot-stage");
const stateTitle = document.querySelector("#state-title");
const stateCode = document.querySelector("#state-code");
const stateCount = document.querySelector("#state-count");
const groupsRoot = document.querySelector("#state-groups");
const editorRoot = document.querySelector("#editor-fields");
const shapeLibraryRoot = document.querySelector("#shape-library");
const shapeCurrentName = document.querySelector("#shape-current-name");
const editorStateName = document.querySelector("#editor-state-name");
const saveStatus = document.querySelector("#save-status");
const autoplayButton = document.querySelector("#autoplay-button");
const titleElement = document.querySelector("#bot-svg-title");

function activeEngineConfig() {
  const state = project.states[activeState];
  return {
    ...state,
    shape: project.shape,
    blinkCadence: state.blinkEnabled ? [Math.min(state.blinkMin, state.blinkMax), Math.max(state.blinkMin, state.blinkMax)] : null,
  };
}

const engine = new GrokBotEngine(svg, activeEngineConfig);

const editorSections = [
  {
    title: "Source expression pool · 原版眼形池",
    controls: [
      { path: "expressionPool", label: "眼形组合", type: "expression-grid" },
      { path: "expressionCadence.0", label: "切换最短", min: 600, max: 16000, step: 100, unit: "ms" },
      { path: "expressionCadence.1", label: "切换最长", min: 600, max: 18000, step: 100, unit: "ms" },
    ],
  },
  {
    title: "Character · 角色",
    controls: [
      { path: "color", label: "头部颜色", type: "color" },
      { path: "eyeColor", label: "眼睛颜色", type: "color" },
      { path: "size", label: "尺寸", min: 240, max: 460, step: 1, unit: "px" },
      { path: "flipX", label: "水平翻转", type: "checkbox" },
      { path: "pointer", label: "指针视线", type: "checkbox" },
    ],
  },
  {
    title: "State morph · 任务形变",
    controls: [
      { path: "morph", label: "几何形变", type: "select", options: ["none", "dots", "orbit", "radar", "progress", "gather", "wave", "send", "receive", "dock", "ball", "whirl", "pencil", "bang", "standby"] },
      { path: "badgeColor", label: "通知颜色", type: "color" },
      { path: "badgeScale", label: "通知尺寸", min: 0.5, max: 1.8, step: 0.01 },
    ],
  },
  {
    title: "Original pose offsets · 原版姿态偏移",
    controls: [
      { path: "headX", label: "头部横向", min: -40, max: 40, step: 0.5, unit: "px" },
      { path: "headY", label: "头部纵向", min: -40, max: 40, step: 0.5, unit: "px" },
      { path: "headRotation", label: "附加旋转", min: -35, max: 35, step: 0.5, unit: "°" },
      { path: "scaleX", label: "横向缩放", min: 0.55, max: 1.5, step: 0.01 },
      { path: "scaleY", label: "纵向缩放", min: 0.55, max: 1.5, step: 0.01 },
      { path: "eyeOpen", label: "眼睛开合", min: 0.08, max: 1.6, step: 0.01 },
      { path: "eyeScale", label: "眼睛尺寸", min: 0.55, max: 1.5, step: 0.01 },
    ],
  },
  {
    title: "Cadence & motion · 时序",
    controls: [
      { path: "blinkEnabled", label: "原版眨眼", type: "checkbox" },
      { path: "blinkMin", label: "眨眼最短", min: 1000, max: 16000, step: 100, unit: "ms" },
      { path: "blinkMax", label: "眨眼最长", min: 1000, max: 18000, step: 100, unit: "ms" },
      { path: "tempo", label: "节奏倍率", min: 0.35, max: 2.5, step: 0.01, unit: "×" },
      { path: "motionScale", label: "身体幅度", min: 0, max: 2, step: 0.01, unit: "×" },
      { path: "gazeScale", label: "视线幅度", min: 0, max: 2, step: 0.01, unit: "×" },
    ],
  },
];

function getAtPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setAtPath(object, path, value) {
  const keys = path.split(".");
  const final = keys.pop();
  const target = keys.reduce((value, key) => value[key], object);
  target[final] = value;
}

function eyePath(ring) {
  return `M${ring.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join("L")}Z`;
}

function centroid(ring) {
  const sum = ring.reduce((value, point) => [value[0] + point[0], value[1] + point[1]], [0, 0]);
  return [sum[0] / ring.length, sum[1] / ring.length];
}

const previewEyes = EXPRESSIONS[0].map((ring) => ({ path: eyePath(ring), center: centroid(ring) }));

function shapeEyeTransform(shape, index) {
  const face = shape.face;
  if (face.x === 0 && face.y === 0 && face.sx === 1 && face.sy === 1 && face.eye === 1) return "";
  const [centerX, centerY] = previewEyes[index].center;
  const x = HEAD_C + face.x + (centerX - HEAD_C) * face.sx;
  const y = HEAD_C + face.y + (centerY - HEAD_C) * face.sy;
  return `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${face.eye.toFixed(3)}) translate(${(-centerX).toFixed(2)} ${(-centerY).toFixed(2)})`;
}

function renderShapeControls() {
  shapeLibraryRoot.replaceChildren();
  for (const [id, shape] of Object.entries(SHAPES)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shape-option";
    button.dataset.shape = id;
    button.setAttribute("aria-label", `选择${shapeLabels[id]}造型（${shape.label}）`);
    const eyes = previewEyes.map((eye, index) => `<path class="shape-option-eye" d="${eye.path}" transform="${shapeEyeTransform(shape, index)}" />`).join("");
    button.innerHTML = `<svg viewBox="-15 -15 259 259" aria-hidden="true"><path class="shape-option-head" d="${shape.path}" />${eyes}</svg><span>${shapeLabels[id]}</span><code>${id}</code>`;
    button.addEventListener("click", () => {
      stopAutoplay();
      if (project.shape === id) return;
      project.shape = id;
      updateShapeValues();
      persistProject();
      commitHistory();
    });
    shapeLibraryRoot.append(button);
  }
}

function updateShapeValues() {
  const shape = SHAPES[project.shape] || SHAPES.blob;
  shapeCurrentName.textContent = `${shapeLabels[project.shape] || shapeLabels.blob} · ${shape.label}`;
  shapeLibraryRoot.querySelectorAll(".shape-option").forEach((button) => {
    const selected = button.dataset.shape === project.shape;
    button.classList.toggle("is-selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderStateControls() {
  groupsRoot.replaceChildren();
  for (const group of stateGroups) {
    const section = document.createElement("section");
    section.className = "state-group";
    section.innerHTML = `<h3>${group.label}</h3>`;
    const grid = document.createElement("div");
    grid.className = "state-grid";
    for (const [id, label] of group.states) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "state-button";
      button.dataset.state = id;
      button.innerHTML = `<span>${label}</span><code>${id}</code>`;
      button.addEventListener("click", () => selectState(id));
      grid.append(button);
    }
    section.append(grid);
    groupsRoot.append(section);
  }
}

function renderEditor() {
  editorRoot.replaceChildren();
  for (const sectionData of editorSections) {
    const section = document.createElement("section");
    section.className = "editor-section";
    const heading = document.createElement("h3");
    heading.textContent = sectionData.title;
    section.append(heading);
    for (const control of sectionData.controls) section.append(createControl(control));
    editorRoot.append(section);
  }
}

function createControl(control) {
  if (control.type === "expression-grid") return createExpressionGrid(control);
  const row = document.createElement("label");
  row.className = `editor-control editor-control--${control.type || "range"}`;
  const label = document.createElement("span");
  label.className = "editor-control-label";
  label.textContent = control.label;
  row.append(label);
  let input;
  if (control.type === "select") {
    input = document.createElement("select");
    for (const optionValue of control.options) input.add(new Option(control.labels?.[optionValue] || optionValue, optionValue));
  } else {
    input = document.createElement("input");
    input.type = control.type || "range";
    if (!control.type || control.type === "range") {
      input.min = control.min;
      input.max = control.max;
      input.step = control.step;
    }
  }
  input.dataset.path = control.path;
  input.addEventListener("input", () => {
    stopAutoplay();
    const value = input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value;
    setAtPath(project.states[activeState], control.path, value);
    if (input.type === "range") output.textContent = formatValue(value, control.unit);
    applyActiveState();
    persistProject();
  });
  input.addEventListener("change", commitHistory);
  row.append(input);
  let output;
  if (!control.type || control.type === "range") {
    output = document.createElement("output");
    output.dataset.outputFor = control.path;
    row.append(output);
  }
  return row;
}

function createExpressionGrid(control) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "expression-picker";
  fieldset.dataset.path = control.path;
  const legend = document.createElement("legend");
  legend.textContent = control.label;
  fieldset.append(legend);
  const grid = document.createElement("div");
  grid.className = "expression-grid";
  EXPRESSIONS.forEach((expression, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "expression-option";
    button.dataset.expression = String(index);
    button.setAttribute("aria-label", `眼形 ${String(index).padStart(2, "0")}`);
    button.innerHTML = `<svg viewBox="45 20 180 190" aria-hidden="true"><path d="${eyePath(expression[0])}"/><path d="${eyePath(expression[1])}"/></svg><span>${String(index).padStart(2, "0")}</span>`;
    button.addEventListener("click", () => {
      stopAutoplay();
      const pool = project.states[activeState].expressionPool;
      const position = pool.indexOf(index);
      if (position >= 0 && pool.length > 1) pool.splice(position, 1);
      else if (position < 0) pool.push(index);
      updateEditorValues();
      engine.setState(activeState, true);
      persistProject();
      commitHistory();
    });
    grid.append(button);
  });
  fieldset.append(grid);
  return fieldset;
}

function formatValue(value, unit = "") {
  const numeric = Number(value);
  return `${Number.isInteger(numeric) ? numeric : numeric.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}${unit || ""}`;
}

function updateEditorValues() {
  const config = project.states[activeState];
  editorStateName.textContent = activeState;
  editorRoot.querySelectorAll("[data-path]").forEach((element) => {
    if (element.classList.contains("expression-picker")) {
      element.querySelectorAll(".expression-option").forEach((button) => button.classList.toggle("is-selected", config.expressionPool.includes(Number(button.dataset.expression))));
      return;
    }
    const value = getAtPath(config, element.dataset.path);
    if (element.type === "checkbox") element.checked = Boolean(value);
    else element.value = value;
  });
  editorRoot.querySelectorAll("[data-output-for]").forEach((output) => {
    const control = editorSections.flatMap((section) => section.controls).find((item) => item.path === output.dataset.outputFor);
    output.textContent = formatValue(getAtPath(config, output.dataset.outputFor), control?.unit);
  });
  updateFidelityStatus();
}

function updateFidelityStatus() {
  const exact = project.shape === defaultProject.shape && JSON.stringify(project.states[activeState]) === JSON.stringify(defaultProject.states[activeState]);
  saveStatus.textContent = exact ? "原版参数" : "已自定义";
  saveStatus.classList.toggle("is-modified", !exact);
}

function applyActiveState(restart = false) {
  const index = stateIds.indexOf(activeState);
  const label = stateLabels[activeState];
  stateTitle.textContent = `${capitalize(activeState)} · ${label}`;
  stateCode.textContent = `data-state="${activeState}"`;
  stateCount.textContent = `${String(index + 1).padStart(2, "0")} / ${stateIds.length}`;
  titleElement.textContent = `Grok Bot ${activeState} expression`;
  document.querySelectorAll(".state-button").forEach((button) => button.classList.toggle("is-active", button.dataset.state === activeState));
  document.querySelectorAll(".swatch").forEach((button) => button.classList.toggle("is-selected", button.dataset.color.toLowerCase() === project.states[activeState].color.toLowerCase()));
  updateEditorValues();
  updateShapeValues();
  if (restart) engine.setState(activeState, true);
}

function selectState(id) {
  if (!stateIds.includes(id)) return;
  stopAutoplay();
  activeState = id;
  window.history.replaceState(null, "", `#${id}`);
  engine.setState(id);
  applyActiveState();
}

function selectPanel(panel) {
  for (const id of ["states", "shapes", "editor"]) {
    const active = id === panel;
    document.querySelector(`#${id}-panel`).hidden = !active;
    document.querySelector(`#${id}-tab`).classList.toggle("is-active", active);
    document.querySelector(`#${id}-tab`).setAttribute("aria-selected", String(active));
  }
}

function startAutoplay() {
  autoplayIndex = Math.max(0, autoplaySequence.indexOf(activeState));
  autoplayButton.classList.add("is-playing");
  autoplayButton.setAttribute("aria-pressed", "true");
  autoplayButton.querySelector(".play-icon").textContent = "■";
  autoplayTimer = window.setInterval(() => {
    autoplayIndex = (autoplayIndex + 1) % autoplaySequence.length;
    activeState = autoplaySequence[autoplayIndex];
    window.history.replaceState(null, "", `#${activeState}`);
    engine.setState(activeState);
    applyActiveState();
  }, 3300);
}

function stopAutoplay() {
  if (autoplayTimer) clearInterval(autoplayTimer);
  autoplayTimer = null;
  autoplayButton.classList.remove("is-playing");
  autoplayButton.setAttribute("aria-pressed", "false");
  autoplayButton.querySelector(".play-icon").textContent = "▶";
}

function persistProject() {
  localStorage.setItem(storageKey, JSON.stringify(project));
  updateFidelityStatus();
}

function commitHistory() {
  const snapshot = JSON.stringify(project);
  if (editHistory[historyIndex] === snapshot) return;
  editHistory = editHistory.slice(0, historyIndex + 1);
  editHistory.push(snapshot);
  if (editHistory.length > 80) editHistory.shift();
  historyIndex = editHistory.length - 1;
  updateHistoryButtons();
}

function stepHistory(direction) {
  const next = historyIndex + direction;
  if (next < 0 || next >= editHistory.length) return;
  historyIndex = next;
  project = normalizeProject(JSON.parse(editHistory[historyIndex]));
  persistProject();
  applyActiveState(true);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  document.querySelector("#undo-button").disabled = historyIndex <= 0;
  document.querySelector("#redo-button").disabled = historyIndex >= editHistory.length - 1;
}

function resetCurrentState() {
  project.states[activeState] = structuredClone(defaultProject.states[activeState]);
  persistProject();
  commitHistory();
  applyActiveState(true);
}

function resetAll() {
  if (!window.confirm("恢复 39 个状态的全部原版参数？当前编辑仍可通过撤销找回。")) return;
  project = createDefaultProject();
  persistProject();
  commitHistory();
  applyActiveState(true);
}

async function copyProject(button) {
  await navigator.clipboard.writeText(JSON.stringify(project, null, 2));
  const original = button.textContent;
  button.textContent = "已复制";
  window.setTimeout(() => { button.textContent = original; }, 1200);
}

function exportProject() {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "grok-bot-original-states.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importProject(file) {
  try {
    project = normalizeProject(JSON.parse(await file.text()));
    persistProject();
    commitHistory();
    applyActiveState(true);
  } catch { window.alert("JSON 文件无法读取或格式不正确。"); }
}

function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

renderStateControls();
renderShapeControls();
renderEditor();
engine.setState(activeState, true);
applyActiveState();
updateHistoryButtons();

document.querySelector("#states-tab").addEventListener("click", () => selectPanel("states"));
document.querySelector("#shapes-tab").addEventListener("click", () => selectPanel("shapes"));
document.querySelector("#editor-tab").addEventListener("click", () => selectPanel("editor"));
autoplayButton.addEventListener("click", () => autoplayTimer ? stopAutoplay() : startAutoplay());
document.querySelector("#undo-button").addEventListener("click", () => stepHistory(-1));
document.querySelector("#redo-button").addEventListener("click", () => stepHistory(1));
document.querySelector("#reset-state-button").addEventListener("click", resetCurrentState);
document.querySelector("#reset-all-button").addEventListener("click", resetAll);
document.querySelector("#export-json-button").addEventListener("click", exportProject);
document.querySelector("#copy-json-button").addEventListener("click", (event) => copyProject(event.currentTarget).catch(() => window.alert("无法访问剪贴板，请使用“导出文件”。")));
document.querySelector("#import-json-input").addEventListener("change", (event) => { const file = event.target.files[0]; if (file) importProject(file); event.target.value = ""; });

document.querySelectorAll(".swatch").forEach((button) => button.addEventListener("click", () => {
  stopAutoplay();
  project.states[activeState].color = button.dataset.color;
  persistProject();
  commitHistory();
  applyActiveState();
}));

window.addEventListener("keydown", (event) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)) return;
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") { event.preventDefault(); stepHistory(event.shiftKey ? 1 : -1); return; }
  if (event.code === "Space") { event.preventDefault(); autoplayTimer ? stopAutoplay() : startAutoplay(); return; }
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  const offset = event.key === "ArrowRight" ? 1 : -1;
  const index = (stateIds.indexOf(activeState) + offset + stateIds.length) % stateIds.length;
  selectState(stateIds[index]);
});

window.addEventListener("hashchange", () => {
  const state = location.hash.slice(1);
  if (stateIds.includes(state) && state !== activeState) { activeState = state; engine.setState(state); applyActiveState(); }
});

stage.addEventListener("focus", () => stage.classList.add("is-focused"));
stage.addEventListener("blur", () => stage.classList.remove("is-focused"));
