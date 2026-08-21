import { EXPRESSIONS, HEAD_C, ORIGINAL_STATE_DATA, SHAPES } from "./original-data.js";
import { GrokBotEngine } from "./grok-bot-engine.js";
import {
  MORPH_BY_STATE,
  SHAPE_LABELS_ZH,
  STATE_CATALOG,
  STATE_GROUPS,
  STATE_IDS,
  STATE_LABELS_ZH,
} from "./component/catalog.js";

const stateGroups = STATE_GROUPS.map((group) => ({
  label: `${group.label.en} · ${group.label.zh}`,
  states: group.states.map((id) => [id, STATE_LABELS_ZH[id]]),
}));
const states = STATE_CATALOG.map(({ id, zh }) => [id, zh]);
const stateIds = STATE_IDS;
const stateLabels = STATE_LABELS_ZH;
const shapeLabels = SHAPE_LABELS_ZH;
const morphByState = MORPH_BY_STATE;

function defaultCharacter() {
  return {
    color: "#0b0b0b",
    eyeColor: "#ffffff",
    size: 390,
    flipX: false,
    pointer: true,
    badgeColor: "#1d9bf0",
    badgeScale: 1,
  };
}

function defaultState(id) {
  const blink = ORIGINAL_STATE_DATA.BLINK_CADENCE[id];
  return {
    expressionPool: [...ORIGINAL_STATE_DATA.EXPRESSION_POOLS[id]],
    expressionWeights: {},
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
  return {
    version: 5,
    shape: "blob",
    character: defaultCharacter(),
    states: Object.fromEntries(stateIds.map((id) => [id, defaultState(id)])),
  };
}

const defaultProject = createDefaultProject();
const storageKey = "grokbot-original-state-lab-v5";
const legacyStorageKeys = ["grokbot-original-state-lab-v4", "grokbot-original-state-lab-v3"];
const characterKeys = Object.keys(defaultCharacter());

function normalizeProject(candidate) {
  const normalized = createDefaultProject();
  if (!candidate?.states) return normalized;
  const requestedShape = candidate.shape ?? candidate.states.idle?.shape;
  if (SHAPES[requestedShape]) normalized.shape = requestedShape;
  const incomingCharacter = candidate.character || candidate.states.idle || {};
  for (const key of characterKeys) {
    if (incomingCharacter[key] !== undefined) normalized.character[key] = incomingCharacter[key];
  }
  for (const id of stateIds) {
    const incoming = candidate.states[id];
    if (!incoming) continue;
    const incomingState = { ...incoming };
    delete incomingState.shape;
    for (const key of characterKeys) delete incomingState[key];
    normalized.states[id] = { ...normalized.states[id], ...incomingState };
    normalized.states[id].expressionPool = Array.isArray(incoming.expressionPool)
      ? incoming.expressionPool.filter((value) => Number.isInteger(value) && value >= 0 && value < EXPRESSIONS.length)
      : normalized.states[id].expressionPool;
    if (!normalized.states[id].expressionPool.length) normalized.states[id].expressionPool = [...defaultProject.states[id].expressionPool];
    normalized.states[id].expressionWeights = Object.fromEntries(normalized.states[id].expressionPool.flatMap((index) => {
      const weight = Number(incoming.expressionWeights?.[index]);
      return Number.isFinite(weight) && weight > 0 && Math.abs(weight - 1) > 0.0001 ? [[index, Math.min(weight, 20)]] : [];
    }));
    normalized.states[id].expressionCadence = Array.isArray(incoming.expressionCadence)
      ? incoming.expressionCadence.slice(0, 2).map(Number)
      : normalized.states[id].expressionCadence;
  }
  return normalized;
}

function loadProject() {
  try {
    const stored = localStorage.getItem(storageKey) ?? legacyStorageKeys.map((key) => localStorage.getItem(key)).find(Boolean);
    return normalizeProject(JSON.parse(stored));
  }
  catch { return createDefaultProject(); }
}

let project = loadProject();
let activeState = location.hash.slice(1);
if (!stateIds.includes(activeState)) activeState = "idle";
let autoplayTimer = null;
let autoplayIndex = 0;
let previewExpressionIndex = null;
let transitionTimer = null;
let transitionRunning = false;
let transitionPhase = "ready";
let transitionPending = null;
let editHistory = [JSON.stringify(project)];
let historyIndex = 0;

const autoplaySequence = ["idle", "curious", "listening", "thinking", "searching", "working", "happy", "playful", "surprised", "celebrate", "orbit", "radar", "progress", "dictating", "writing", "sending", "receiving", "uploading", "notifying", "alerting", "bouncing", "drowsy", "sleeping", "waking"];
const stateDwell = {
  drowsy: 6000,
  celebrate: 6800,
  progress: 4600,
  spawning: 4100,
  waking: 3300,
  sleeping: 4000,
  dragging: 3800,
};

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
const runtimeReadout = document.querySelector("#runtime-readout");
const transitionFrom = document.querySelector("#transition-from");
const transitionTo = document.querySelector("#transition-to");
const transitionHoldA = document.querySelector("#transition-hold-a");
const transitionHoldB = document.querySelector("#transition-hold-b");
const transitionLoop = document.querySelector("#transition-loop");
const transitionStatus = document.querySelector("#transition-status");
const playbackRate = document.querySelector("#playback-rate");
const transitionPause = document.querySelector("#transition-pause");
const morphPhase = document.querySelector("#morph-phase");
const morphCurrentEffect = document.querySelector("#morph-current-effect");
const morphLogicBadge = document.querySelector("#morph-logic-badge");
const morphLogicDescription = document.querySelector("#morph-logic-description");
const morphPreviewDuration = document.querySelector("#morph-preview-duration");
const morphTriggerOnce = document.querySelector("#morph-trigger-once");
const morphRestoreDefault = document.querySelector("#morph-restore-default");
let morphDurationKey = null;

function activeEngineConfig() {
  const state = project.states[activeState];
  return {
    ...project.character,
    ...state,
    expressionPool: previewExpressionIndex === null ? state.expressionPool : [previewExpressionIndex],
    expressionCadence: previewExpressionIndex === null ? state.expressionCadence : [3600000, 3600000],
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
      { path: "color", label: "头部颜色", type: "color", scope: "character" },
      { path: "eyeColor", label: "眼睛颜色", type: "color", scope: "character" },
      { path: "size", label: "尺寸", min: 240, max: 460, step: 1, unit: "px", scope: "character" },
      { path: "flipX", label: "水平翻转", type: "checkbox", scope: "character" },
      { path: "pointer", label: "指针视线", type: "checkbox", scope: "character" },
    ],
  },
  {
    title: "State morph · 任务形变",
    controls: [
      { path: "morph", label: "状态默认形变", type: "select", options: ["none", "dots", "orbit", "radar", "progress", "gather", "wave", "send", "receive", "dock", "ball", "whirl", "pencil", "bang", "standby"] },
      { path: "badgeColor", label: "通知颜色", type: "color", scope: "character" },
      { path: "badgeScale", label: "通知尺寸", min: 0.5, max: 1.8, step: 0.01, scope: "character" },
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

function controlTarget(controlOrElement) {
  return controlOrElement.scope === "character" || controlOrElement.dataset?.scope === "character"
    ? project.character
    : project.states[activeState];
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
      stopPlaybackSequences();
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
  input.dataset.scope = control.scope || "state";
  input.addEventListener("input", () => {
    stopPlaybackSequences();
    if (control.path === "morph") engine.clearMorphPreview();
    const value = input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value;
    setAtPath(controlTarget(control), control.path, value);
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
    output.dataset.scope = control.scope || "state";
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
      stopPlaybackSequences();
      const pool = project.states[activeState].expressionPool;
      const position = pool.indexOf(index);
      if (position >= 0 && pool.length > 1) {
        pool.splice(position, 1);
        delete project.states[activeState].expressionWeights[index];
        if (previewExpressionIndex === index) previewExpressionIndex = null;
      }
      else if (position < 0) pool.push(index);
      updateEditorValues();
      engine.setState(activeState, true);
      persistProject();
      commitHistory();
    });
    grid.append(button);
  });
  fieldset.append(grid);
  const order = document.createElement("div");
  order.className = "expression-pool-order";
  fieldset.append(order);
  return fieldset;
}

function renderExpressionPoolOrder(fieldset, config) {
  const root = fieldset.querySelector(".expression-pool-order");
  root.replaceChildren();
  const heading = document.createElement("div");
  heading.className = "expression-pool-heading";
  heading.innerHTML = `<span>播放顺序</span><small>${config.expressionPool.length} poses</small>`;
  root.append(heading);
  config.expressionPool.forEach((expressionIndex, position) => {
    const row = document.createElement("div");
    row.className = "expression-pool-item";
    row.dataset.expression = String(expressionIndex);
    if (previewExpressionIndex === expressionIndex) row.classList.add("is-previewing");
    const code = document.createElement("code");
    code.textContent = `E${String(expressionIndex).padStart(2, "0")}`;
    const preview = document.createElement("button");
    preview.type = "button";
    preview.className = "expression-preview-button";
    preview.textContent = previewExpressionIndex === expressionIndex ? "退出" : "预览";
    preview.addEventListener("click", () => {
      stopPlaybackSequences();
      previewExpressionIndex = previewExpressionIndex === expressionIndex ? null : expressionIndex;
      updateEditorValues();
      engine.setState(activeState, true);
    });
    const move = document.createElement("span");
    move.className = "expression-order-buttons";
    for (const [label, offset] of [["↑", -1], ["↓", 1]]) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = position + offset < 0 || position + offset >= config.expressionPool.length;
      button.setAttribute("aria-label", `${label === "↑" ? "前移" : "后移"} E${String(expressionIndex).padStart(2, "0")}`);
      button.addEventListener("click", () => {
        stopPlaybackSequences();
        const target = position + offset;
        [config.expressionPool[position], config.expressionPool[target]] = [config.expressionPool[target], config.expressionPool[position]];
        updateEditorValues();
        engine.setState(activeState, true);
        persistProject();
        commitHistory();
      });
      move.append(button);
    }
    const weightLabel = document.createElement("label");
    weightLabel.className = "expression-weight";
    weightLabel.innerHTML = "<span>权重</span>";
    const weight = document.createElement("input");
    weight.type = "number";
    weight.min = "0.1";
    weight.max = "20";
    weight.step = "0.1";
    weight.value = String(config.expressionWeights?.[expressionIndex] ?? 1);
    weight.addEventListener("change", () => {
      stopPlaybackSequences();
      const next = Math.min(20, Math.max(0.1, Number(weight.value) || 1));
      if (Math.abs(next - 1) < 0.0001) delete config.expressionWeights[expressionIndex];
      else config.expressionWeights[expressionIndex] = next;
      weight.value = String(next);
      persistProject();
      commitHistory();
    });
    weightLabel.append(weight);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "expression-remove-button";
    remove.textContent = "×";
    remove.disabled = config.expressionPool.length <= 1;
    remove.setAttribute("aria-label", `移除 E${String(expressionIndex).padStart(2, "0")}`);
    remove.addEventListener("click", () => {
      if (config.expressionPool.length <= 1) return;
      stopPlaybackSequences();
      config.expressionPool.splice(position, 1);
      delete config.expressionWeights[expressionIndex];
      if (previewExpressionIndex === expressionIndex) previewExpressionIndex = null;
      updateEditorValues();
      engine.setState(activeState, true);
      persistProject();
      commitHistory();
    });
    row.append(code, preview, move, weightLabel, remove);
    root.append(row);
  });
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
      element.querySelectorAll(".expression-option").forEach((button) => {
        const index = Number(button.dataset.expression);
        button.classList.toggle("is-selected", config.expressionPool.includes(index));
        button.classList.toggle("is-previewing", previewExpressionIndex === index);
      });
      renderExpressionPoolOrder(element, config);
      return;
    }
    const value = getAtPath(controlTarget(element), element.dataset.path);
    if (element.type === "checkbox") element.checked = Boolean(value);
    else element.value = value;
  });
  editorRoot.querySelectorAll("[data-output-for]").forEach((output) => {
    const control = editorSections.flatMap((section) => section.controls)
      .find((item) => item.path === output.dataset.outputFor && (item.scope || "state") === output.dataset.scope);
    output.textContent = formatValue(getAtPath(controlTarget(output), output.dataset.outputFor), control?.unit);
  });
  updateFidelityStatus();
}

function updateFidelityStatus() {
  const exact = project.shape === defaultProject.shape
    && JSON.stringify(project.character) === JSON.stringify(defaultProject.character)
    && JSON.stringify(project.states[activeState]) === JSON.stringify(defaultProject.states[activeState]);
  saveStatus.textContent = exact ? "原版参数" : "已自定义";
  saveStatus.classList.toggle("is-modified", !exact);
}

function updateMorphConsole(snapshot = engine.getSnapshot()) {
  const effect = project.states[activeState].morph;
  const sourceEffect = morphByState[activeState] || "none";
  const customized = effect !== sourceEffect;
  const durationKey = `${activeState}:${effect}`;
  if (morphDurationKey !== durationKey) {
    morphPreviewDuration.value = String(activeState === "spawning" ? 2000 : 2500);
    morphDurationKey = durationKey;
  }
  morphCurrentEffect.textContent = effect;
  morphPhase.textContent = snapshot.morphPhase;
  morphPhase.dataset.phase = snapshot.morphPhase;
  morphTriggerOnce.disabled = effect === "none";
  morphRestoreDefault.disabled = !engine.morphPreview;
  if (effect === "none") {
    morphLogicBadge.textContent = sourceEffect === "none" ? "无默认形变" : "已关闭状态形变";
    morphLogicDescription.textContent = sourceEffect === "none"
      ? "当前状态不会自动请求几何形变。请先在下方选择形变，再使用单次触发。"
      : `该状态的原版 ${sourceEffect} 已被关闭，可从下方恢复或改选其他形变。`;
  } else if (activeState === "progress" || activeState === "spawning") {
    const shot = activeState === "progress" ? "2.5 秒" : "2 秒";
    morphLogicBadge.textContent = customized ? "自定义循环" : "原版循环";
    morphLogicDescription.textContent = `${shot}展示 → 1.5 秒 REST → 自动再次触发。单次触发会在退出后停留于 bot。`;
  } else {
    morphLogicBadge.textContent = customized ? "自定义持续" : "原版持续";
    morphLogicDescription.textContent = "状态驻留期间持续保持，离开状态才退出。单次触发会完整播放并停留于 bot。";
  }
}

function applyActiveState(restart = false) {
  const index = stateIds.indexOf(activeState);
  const label = stateLabels[activeState];
  stateTitle.textContent = `${capitalize(activeState)} · ${label}`;
  stateCode.textContent = `data-state="${activeState}"`;
  stateCount.textContent = `${String(index + 1).padStart(2, "0")} / ${stateIds.length}`;
  titleElement.textContent = `Grok Bot ${activeState} expression`;
  document.querySelectorAll(".state-button").forEach((button) => button.classList.toggle("is-active", button.dataset.state === activeState));
  document.querySelectorAll(".swatch").forEach((button) => button.classList.toggle("is-selected", button.dataset.color.toLowerCase() === project.character.color.toLowerCase()));
  updateEditorValues();
  updateShapeValues();
  updateMorphConsole();
  if (restart) engine.setState(activeState, true);
}

function activateState(id, restart = false) {
  if (!stateIds.includes(id)) return;
  const replay = restart || id === activeState;
  activeState = id;
  previewExpressionIndex = null;
  window.history.replaceState(null, "", `#${id}`);
  engine.setState(id, replay);
  applyActiveState();
}

function selectState(id) {
  if (!stateIds.includes(id)) return;
  stopPlaybackSequences();
  activateState(id, id === activeState);
  transitionFrom.value = id;
  if (transitionTo.value === id) transitionTo.value = stateIds[(stateIds.indexOf(id) + 1) % stateIds.length];
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
  stopTransition();
  engine.setPaused(false);
  autoplayIndex = Math.max(0, autoplaySequence.indexOf(activeState));
  autoplayButton.classList.add("is-playing");
  autoplayButton.setAttribute("aria-pressed", "true");
  autoplayButton.querySelector(".play-icon").textContent = "■";
  const advanceAutoplay = () => {
    autoplayIndex = (autoplayIndex + 1) % autoplaySequence.length;
    activateState(autoplaySequence[autoplayIndex]);
    const dwell = stateDwell[activeState] || 3300;
    autoplayTimer = window.setTimeout(advanceAutoplay, dwell / engine.playbackRate);
  };
  autoplayTimer = window.setTimeout(advanceAutoplay, (stateDwell[activeState] || 3300) / engine.playbackRate);
}

function stopAutoplay() {
  if (autoplayTimer) clearTimeout(autoplayTimer);
  autoplayTimer = null;
  autoplayButton.classList.remove("is-playing");
  autoplayButton.setAttribute("aria-pressed", "false");
  autoplayButton.querySelector(".play-icon").textContent = "▶";
}

function updateTransitionStatus(label = transitionPhase) {
  transitionStatus.textContent = `${engine.paused ? "PAUSED" : transitionRunning ? "RUN" : "READY"} · ${label}`.toUpperCase();
  transitionPause.textContent = engine.paused ? "▶ 继续" : "Ⅱ 暂停";
}

function scheduleTransition(milliseconds, callback) {
  const remainingSimMs = Math.max(0, Number(milliseconds) || 0);
  const rate = engine.playbackRate;
  transitionPending = { callback, remainingSimMs, rate, startedAt: performance.now() };
  transitionTimer = window.setTimeout(() => {
    transitionTimer = null;
    transitionPending = null;
    callback();
  }, remainingSimMs / rate);
}

function freezeTransitionSchedule() {
  if (!transitionPending) return;
  const elapsedSimMs = Math.max(0, performance.now() - transitionPending.startedAt) * transitionPending.rate;
  transitionPending.remainingSimMs = Math.max(0, transitionPending.remainingSimMs - elapsedSimMs);
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = null;
}

function resumeTransitionSchedule() {
  if (!transitionPending || transitionTimer) return;
  scheduleTransition(transitionPending.remainingSimMs, transitionPending.callback);
}

function stopTransition({ resumeEngine = true, label = "ready" } = {}) {
  if (transitionTimer) clearTimeout(transitionTimer);
  transitionTimer = null;
  transitionPending = null;
  transitionRunning = false;
  transitionPhase = label;
  if (resumeEngine) engine.setPaused(false);
  updateTransitionStatus(label);
}

function stopPlaybackSequences() {
  stopAutoplay();
  stopTransition();
}

function transitionDuration(input) {
  const value = Math.min(20000, Math.max(100, Number(input.value) || 100));
  input.value = String(value);
  return value;
}

function playTransition() {
  stopAutoplay();
  stopTransition();
  const from = transitionFrom.value;
  const to = transitionTo.value;
  const runA = () => {
    if (!transitionRunning) return;
    transitionPhase = `A · ${from}`;
    activateState(from, true);
    updateTransitionStatus(transitionPhase);
    scheduleTransition(transitionDuration(transitionHoldA), runB);
  };
  const runB = () => {
    if (!transitionRunning) return;
    transitionPhase = `B · ${to}`;
    activateState(to, true);
    updateTransitionStatus(transitionPhase);
    scheduleTransition(transitionDuration(transitionHoldB), () => {
      if (transitionLoop.checked) runA();
      else stopTransition({ label: `${from} → ${to} done` });
    });
  };
  transitionRunning = true;
  engine.setPlaybackRate(Number(playbackRate.value));
  engine.setPaused(false);
  runA();
}

function toggleTransitionPause() {
  if (engine.paused) {
    engine.setPaused(false);
    if (transitionRunning) resumeTransitionSchedule();
  } else {
    if (transitionRunning) freezeTransitionSchedule();
    engine.setPaused(true);
  }
  updateTransitionStatus(transitionPhase);
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
  stopPlaybackSequences();
  historyIndex = next;
  project = normalizeProject(JSON.parse(editHistory[historyIndex]));
  previewExpressionIndex = null;
  persistProject();
  applyActiveState(true);
  updateHistoryButtons();
}

function updateHistoryButtons() {
  document.querySelector("#undo-button").disabled = historyIndex <= 0;
  document.querySelector("#redo-button").disabled = historyIndex >= editHistory.length - 1;
}

function resetCurrentState() {
  stopPlaybackSequences();
  previewExpressionIndex = null;
  project.states[activeState] = structuredClone(defaultProject.states[activeState]);
  persistProject();
  commitHistory();
  applyActiveState(true);
}

function resetCharacter() {
  stopPlaybackSequences();
  project.character = defaultCharacter();
  persistProject();
  commitHistory();
  applyActiveState();
}

function resetAll() {
  if (!window.confirm("恢复 39 个状态的全部原版参数？当前编辑仍可通过撤销找回。")) return;
  stopPlaybackSequences();
  project = createDefaultProject();
  previewExpressionIndex = null;
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
  link.download = "grok-bot-original-states-v5.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function importProject(file) {
  try {
    stopPlaybackSequences();
    project = normalizeProject(JSON.parse(await file.text()));
    previewExpressionIndex = null;
    persistProject();
    commitHistory();
    applyActiveState(true);
  } catch { window.alert("JSON 文件无法读取或格式不正确。"); }
}

function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }

for (const [id, label] of states) {
  transitionFrom.add(new Option(`${label} · ${id}`, id));
  transitionTo.add(new Option(`${label} · ${id}`, id));
}
transitionFrom.value = activeState;
transitionTo.value = activeState === "thinking" ? "idle" : "thinking";

renderStateControls();
renderShapeControls();
renderEditor();
engine.setState(activeState, true);
applyActiveState();
updateHistoryButtons();
updateTransitionStatus();

let lastRuntimeReadout = -Infinity;
function updateRuntimeReadout(realNow) {
  if (realNow - lastRuntimeReadout > 100) {
    const snapshot = engine.getSnapshot();
    const expression = `E${String(snapshot.expressionIndex).padStart(2, "0")}`;
    const morph = snapshot.morphEffect ? `${snapshot.morphEffect} ${snapshot.morphAmount.toFixed(2)}` : "none 0.00";
    runtimeReadout.textContent = `${expression} · eye ${snapshot.eyeOpen.toFixed(2)} · morph ${morph} · ${snapshot.morphPhase} · ${snapshot.elapsed.toFixed(1)}s${snapshot.paused ? " · paused" : ""}`;
    updateMorphConsole(snapshot);
    lastRuntimeReadout = realNow;
  }
  requestAnimationFrame(updateRuntimeReadout);
}
requestAnimationFrame(updateRuntimeReadout);

document.querySelector("#states-tab").addEventListener("click", () => selectPanel("states"));
document.querySelector("#shapes-tab").addEventListener("click", () => selectPanel("shapes"));
document.querySelector("#editor-tab").addEventListener("click", () => selectPanel("editor"));
autoplayButton.addEventListener("click", () => autoplayTimer ? stopAutoplay() : startAutoplay());
document.querySelector("#transition-play").addEventListener("click", playTransition);
document.querySelector("#transition-stop").addEventListener("click", () => { stopAutoplay(); stopTransition(); });
transitionPause.addEventListener("click", toggleTransitionPause);
document.querySelector("#transition-step").addEventListener("click", () => {
  stopAutoplay();
  if (transitionRunning && !engine.paused) freezeTransitionSchedule();
  engine.stepFrame();
  updateTransitionStatus(`${transitionPhase} · +1 frame`);
});
document.querySelector("#transition-replay").addEventListener("click", () => {
  stopPlaybackSequences();
  engine.setState(activeState, true);
  updateTransitionStatus(`replay · ${activeState}`);
});
playbackRate.addEventListener("change", () => {
  stopAutoplay();
  const wasScheduled = transitionRunning && !engine.paused;
  if (wasScheduled) freezeTransitionSchedule();
  engine.setPlaybackRate(Number(playbackRate.value));
  if (wasScheduled) resumeTransitionSchedule();
  updateTransitionStatus(transitionPhase);
});
[transitionHoldA, transitionHoldB].forEach((input) => input.addEventListener("change", () => transitionDuration(input)));
morphPreviewDuration.addEventListener("change", () => {
  const duration = Math.min(20000, Math.max(100, Number(morphPreviewDuration.value) || 2500));
  morphPreviewDuration.value = String(duration);
});
morphTriggerOnce.addEventListener("click", () => {
  const effect = project.states[activeState].morph;
  if (effect === "none") return;
  stopPlaybackSequences();
  engine.triggerMorphPreview(effect, Number(morphPreviewDuration.value));
  updateMorphConsole();
});
morphRestoreDefault.addEventListener("click", () => {
  stopPlaybackSequences();
  engine.clearMorphPreview();
  updateMorphConsole();
});
document.querySelector("#undo-button").addEventListener("click", () => stepHistory(-1));
document.querySelector("#redo-button").addEventListener("click", () => stepHistory(1));
document.querySelector("#reset-state-button").addEventListener("click", resetCurrentState);
document.querySelector("#reset-character-button").addEventListener("click", resetCharacter);
document.querySelector("#reset-all-button").addEventListener("click", resetAll);
document.querySelector("#export-json-button").addEventListener("click", exportProject);
document.querySelector("#copy-json-button").addEventListener("click", (event) => copyProject(event.currentTarget).catch(() => window.alert("无法访问剪贴板，请使用“导出文件”。")));
document.querySelector("#import-json-input").addEventListener("change", (event) => { const file = event.target.files[0]; if (file) importProject(file); event.target.value = ""; });

document.querySelectorAll(".swatch").forEach((button) => button.addEventListener("click", () => {
  stopPlaybackSequences();
  project.character.color = button.dataset.color;
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
  if (stateIds.includes(state) && state !== activeState) {
    stopPlaybackSequences();
    activateState(state);
    transitionFrom.value = state;
  }
});

stage.addEventListener("focus", () => stage.classList.add("is-focused"));
stage.addEventListener("blur", () => stage.classList.remove("is-focused"));
