import {
  MORPH_BOT_EFFECTS,
  MORPH_BOT_SHAPES,
  MORPH_BOT_STATES,
} from "./morph-bot.js";

const stateLabels = {
  sleeping: "睡眠", waking: "醒来", idle: "待机", listening: "倾听", thinking: "思考", searching: "搜索", working: "工作",
  excited: "兴奋", surprised: "惊讶", suspicious: "怀疑", angry: "生气", drowsy: "困倦", happy: "开心", curious: "好奇",
  confused: "困惑", bored: "无聊", proud: "得意", shy: "害羞", sad: "难过", laughing: "大笑", scared: "害怕", playful: "调皮",
  celebrate: "庆祝", orbit: "轨道", radar: "雷达", progress: "进度", spawning: "生成", humming: "运转", loading: "加载",
  dictating: "听写", writing: "书写", sending: "发送", receiving: "接收", uploading: "上传", notifying: "通知", alerting: "警报",
  dragging: "拖拽", bouncing: "弹跳", "powering-down": "关机",
};

const shapeLabels = {
  blob: "圆形", pebble: "卵石", bean: "豆形", egg: "蛋形", squircle: "圆角方形", tablet: "圆角矩形", capsule: "胶囊",
  cylinder: "圆柱", hex: "六边形", gem: "宝石", crystal: "水晶", wedge: "三角楔形", shield: "盾牌", dome: "拱顶",
  arch: "拱门", cloud: "云朵", teardrop: "水滴", leaf: "叶片",
};

const effectLabels = {
  dots: "思考点阵", orbit: "彩色轨道", radar: "雷达扫描", progress: "循环进度", gather: "聚合生成", wave: "声音波形", send: "向外发送",
  receive: "接收进入", dock: "上传停靠", ball: "弹跳球体", whirl: "旋转加载", pencil: "书写铅笔", bang: "警报符号", standby: "待机关机",
};

const orderedStates = ["idle", ...MORPH_BOT_STATES.filter((state) => state !== "idle")];
const stateInput = document.querySelector("#demo-state");
const shapeInput = document.querySelector("#demo-shape");
const stateGrid = document.querySelector("#state-grid");
const shapeGrid = document.querySelector("#shape-grid");
const sizeInput = document.querySelector("#demo-size");
const sizeOutput = document.querySelector("#demo-size-output");
const colorInput = document.querySelector("#demo-color");
const eyeColorInput = document.querySelector("#demo-eye-color");
const speedSelect = document.querySelector("#demo-speed");
const pointerInput = document.querySelector("#demo-pointer");
const pauseButton = document.querySelector("#demo-pause");
const sequenceList = document.querySelector("#sequence-list");
const sequenceMorphGrid = document.querySelector("#sequence-morph-grid");
const selectedSequenceStepOutput = document.querySelector("#selected-sequence-step");
const sequenceLoop = document.querySelector("#sequence-loop");
const sequenceSummary = document.querySelector("#sequence-summary");
const addSequenceStepButton = document.querySelector("#add-sequence-step");
const previewSequenceButton = document.querySelector("#preview-sequence");
const stopSequenceButton = document.querySelector("#stop-sequence");
const bot = document.querySelector("#demo-bot");
const previewStage = document.querySelector("#preview-stage");
const contextTitle = document.querySelector("#context-title");
const contextDescription = document.querySelector("#context-description");
const readout = document.querySelector("#demo-readout");
const runtime = document.querySelector("#demo-runtime");
const code = document.querySelector("#component-code");

let codeMode = "static";
let selectedStepIndex = 1;
let playingStepIndex = -1;
let sequenceRun = 0;
let sequencePlaying = false;
const sequence = [
  { state: "idle", hold: 1000, morph: "gather", morphHold: 700 },
  { state: "thinking", hold: 2400, morph: "send", morphHold: 700 },
  { state: "celebrate", hold: 1600, morph: null, morphHold: 1000 },
];

function botThumbnail({ state, shape, size }) {
  const preview = document.createElement("morph-bot");
  preview.setAttribute("state", state);
  preview.setAttribute("shape", shape);
  preview.setAttribute("size", size);
  preview.setAttribute("decorative", "");
  preview.setAttribute("thumbnail", "");
  return preview;
}

for (const state of orderedStates) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.stateOption = state;
  button.setAttribute("aria-label", `选择${stateLabels[state]}状态`);
  button.append(botThumbnail({ state, shape: "blob", size: 34 }));
  const label = document.createElement("span");
  label.className = "state-option-copy";
  label.innerHTML = `<strong>${stateLabels[state]}</strong><code>${state}</code>`;
  const markers = document.createElement("span");
  markers.className = "state-role-markers";
  button.append(label, markers);
  stateGrid.append(button);
}

for (const shape of MORPH_BOT_SHAPES) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.shapeOption = shape;
  button.setAttribute("aria-label", `选择${shapeLabels[shape]}形状`);
  button.append(botThumbnail({ state: "idle", shape, size: 38 }));
  const label = document.createElement("span");
  label.innerHTML = `<strong>${shapeLabels[shape]}</strong><code>${shape}</code>`;
  button.append(label);
  shapeGrid.append(button);
}

shapeInput.value = "blob";
stateInput.value = sequence[selectedStepIndex].state;

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function componentAttributes(state) {
  const attributes = [
    `state="${escapeAttribute(state)}"`,
    `shape="${escapeAttribute(shapeInput.value)}"`,
    `size="${sizeInput.value}"`,
    `color="${escapeAttribute(colorInput.value)}"`,
  ];
  if (eyeColorInput.value.toLowerCase() !== "#ffffff") attributes.push(`eye-color="${escapeAttribute(eyeColorInput.value)}"`);
  if (speedSelect.value !== "1") attributes.push(`speed="${speedSelect.value}"`);
  if (pointerInput.checked) attributes.push("follow-pointer");
  return attributes.join("\n  ");
}

function staticCode() {
  return `<script type="module" src="./morph-bot/morph-bot.js"></script>\n\n<morph-bot\n  ${componentAttributes(stateInput.value)}\n  label="${stateLabels[stateInput.value]}动画"\n></morph-bot>`;
}

function sequenceStepCode(step) {
  const fields = [`state: "${step.state}"`, `hold: ${step.hold}`];
  if (step.morph) fields.push(`morph: "${step.morph}"`, `morphHold: ${step.morphHold}`);
  return `  { ${fields.join(", ")} }`;
}

function sequenceCode() {
  const first = sequence[0];
  const steps = sequence.map(sequenceStepCode).join(",\n");
  return `<script type="module" src="./morph-bot/morph-bot.js"></script>\n\n<button id="start-bot-sequence">播放动画</button>\n<button id="stop-bot-sequence">停止</button>\n\n<morph-bot\n  id="status-bot"\n  ${componentAttributes(first.state)}\n  label="任务状态"\n></morph-bot>\n\n<script type="module">\n  const bot = document.querySelector("#status-bot");\n  const sequence = [\n${steps}\n  ];\n\n  document.querySelector("#start-bot-sequence")\n    .addEventListener("click", () => {\n      bot.playSequence(sequence, { loop: ${sequenceLoop.checked} });\n    });\n\n  document.querySelector("#stop-bot-sequence")\n    .addEventListener("click", () => bot.stopSequence());\n</script>`;
}

function contextText(state) {
  const label = stateLabels[state];
  if (state === "idle") return ["等待任务", "状态可以随时切换"];
  if (state === "celebrate") return ["任务已完成", "结果已经准备好了"];
  if (["sad", "scared", "confused", "alerting"].includes(state)) return [`当前状态：${label}`, "你可以随时切换状态"];
  return [`正在${label}`, "通常只需要几秒钟"];
}

function renderSequence() {
  selectedStepIndex = Math.max(0, Math.min(selectedStepIndex, sequence.length - 1));
  sequenceList.replaceChildren();
  sequence.forEach((step, index) => {
    const article = document.createElement("article");
    article.className = "sequence-step";
    article.dataset.sequenceIndex = String(index);
    article.classList.toggle("is-selected", index === selectedStepIndex);
    article.classList.toggle("is-playing", index === playingStepIndex);
    article.innerHTML = `
      <button class="sequence-identity" type="button" data-select-sequence-step aria-pressed="${index === selectedStepIndex}">
        <span class="sequence-number">${index + 1}</span>
        <morph-bot state="${step.state}" shape="${shapeInput.value}" size="34" color="${colorInput.value}" eye-color="${eyeColorInput.value}" thumbnail decorative></morph-bot>
        <span><strong>${stateLabels[step.state]}</strong><code>${step.state}</code></span>
      </button>
      <label class="sequence-field"><span>状态停留</span><input data-step-hold type="number" min="0" max="600" step="0.1" value="${step.hold / 1000}" /><i>秒</i></label>
      <div class="sequence-morph-readout"><span>停留后播放</span><strong>${step.morph ? effectLabels[step.morph] : "不触发"}</strong><code>${step.morph || "none"}</code></div>
      <label class="sequence-field${step.morph ? "" : " is-disabled"}"><span>Morph 保持</span><input data-step-morph-hold type="number" min="0" max="600" step="0.1" value="${step.morphHold / 1000}"${step.morph ? "" : " disabled"} /><i>秒</i></label>
      <div class="sequence-actions">
        <button type="button" data-sequence-action="up" aria-label="上移第 ${index + 1} 步"${index === 0 ? " disabled" : ""}>↑</button>
        <button type="button" data-sequence-action="down" aria-label="下移第 ${index + 1} 步"${index === sequence.length - 1 ? " disabled" : ""}>↓</button>
        <button type="button" data-sequence-action="delete" aria-label="删除第 ${index + 1} 步"${sequence.length === 1 ? " disabled" : ""}>删除</button>
      </div>`;
    sequenceList.append(article);
  });
  renderMorphPalette();
  syncSequenceSummary();
  syncStateMarkers();
}

function renderMorphPalette() {
  const selected = sequence[selectedStepIndex].morph;
  selectedSequenceStepOutput.textContent = `第 ${selectedStepIndex + 1} 步`;
  sequenceMorphGrid.replaceChildren();
  for (const effect of [null, ...MORPH_BOT_EFFECTS]) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.morphOption = effect || "none";
    button.classList.toggle("is-selected", selected === effect);
    button.setAttribute("aria-pressed", String(selected === effect));
    button.innerHTML = `<strong>${effect ? effectLabels[effect] : "不触发"}</strong><code>${effect || "none"}</code>`;
    sequenceMorphGrid.append(button);
  }
}

function syncSequenceSummary(text = "") {
  const stateHold = sequence.reduce((total, step) => total + step.hold, 0) / 1000;
  sequenceSummary.textContent = text || `${sequence.length} 步 · 状态停留 ${Number(stateHold.toFixed(1))} 秒`;
}

function syncStateMarkers() {
  stateGrid.querySelectorAll("[data-state-option]").forEach((button) => {
    const state = button.dataset.stateOption;
    const markers = sequence.flatMap((step, index) => step.state === state
      ? [`<i class="sequence-role${index === selectedStepIndex ? " is-selected" : ""}">${index + 1}</i>`]
      : []);
    button.querySelector(".state-role-markers").innerHTML = markers.join("");
    button.classList.toggle("has-sequence-step", markers.length > 0);
  });
}

function syncThumbnailAppearance() {
  stateGrid.querySelectorAll("morph-bot").forEach((preview) => {
    if (preview.getAttribute("color") !== colorInput.value) preview.setAttribute("color", colorInput.value);
    if (preview.getAttribute("eye-color") !== eyeColorInput.value) preview.setAttribute("eye-color", eyeColorInput.value);
  });
  shapeGrid.querySelectorAll("morph-bot").forEach((preview) => {
    if (preview.getAttribute("color") !== colorInput.value) preview.setAttribute("color", colorInput.value);
    if (preview.getAttribute("eye-color") !== eyeColorInput.value) preview.setAttribute("eye-color", eyeColorInput.value);
  });
  sequenceList.querySelectorAll("morph-bot").forEach((stepBot) => {
    if (stepBot.shape !== shapeInput.value) stepBot.shape = shapeInput.value;
    if (stepBot.getAttribute("color") !== colorInput.value) stepBot.setAttribute("color", colorInput.value);
    if (stepBot.getAttribute("eye-color") !== eyeColorInput.value) stepBot.setAttribute("eye-color", eyeColorInput.value);
  });
}

function setCodeMode(mode) {
  codeMode = mode;
  document.querySelectorAll("[data-code-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.codeMode === codeMode));
}

function syncSequencePlaybackUI() {
  sequenceList.querySelectorAll("[data-sequence-index]").forEach((row) => {
    row.classList.toggle("is-selected", Number(row.dataset.sequenceIndex) === selectedStepIndex);
    row.classList.toggle("is-playing", Number(row.dataset.sequenceIndex) === playingStepIndex);
    row.querySelector("[data-select-sequence-step]").setAttribute("aria-pressed", String(Number(row.dataset.sequenceIndex) === selectedStepIndex));
  });
  previewSequenceButton.disabled = sequencePlaying;
  previewSequenceButton.innerHTML = sequencePlaying ? "正在播放…" : "<span>▶</span> 播放时间线";
  stopSequenceButton.disabled = !sequencePlaying;
}

function stopEditorSequence({ resetSummary = true } = {}) {
  sequenceRun += 1;
  bot.stopSequence();
  sequencePlaying = false;
  playingStepIndex = -1;
  if (resetSummary) syncSequenceSummary();
  syncSequencePlaybackUI();
}

function syncDemo() {
  bot.state = stateInput.value;
  bot.shape = shapeInput.value;
  bot.size = Number(sizeInput.value);
  bot.setAttribute("color", colorInput.value);
  bot.setAttribute("eye-color", eyeColorInput.value);
  bot.speed = Number(speedSelect.value);
  bot.toggleAttribute("follow-pointer", pointerInput.checked);
  sizeOutput.textContent = `${sizeInput.value}px`;
  readout.textContent = `${stateInput.value} · ${shapeInput.value} · ${sizeInput.value}px`;
  [contextTitle.textContent, contextDescription.textContent] = contextText(stateInput.value);
  code.textContent = codeMode === "sequence" ? sequenceCode() : staticCode();
  stateGrid.querySelectorAll("[data-state-option]").forEach((button) => button.classList.toggle("is-active", button.dataset.stateOption === stateInput.value));
  shapeGrid.querySelectorAll("[data-shape-option]").forEach((button) => button.classList.toggle("is-active", button.dataset.shapeOption === shapeInput.value));
  syncStateMarkers();
  syncThumbnailAppearance();
}

[sizeInput, colorInput, eyeColorInput, speedSelect, pointerInput].forEach((input) => input.addEventListener("input", syncDemo));

stateGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-state-option]");
  if (!button) return;
  stopEditorSequence();
  sequence[selectedStepIndex].state = button.dataset.stateOption;
  stateInput.value = button.dataset.stateOption;
  setCodeMode("sequence");
  renderSequence();
  syncDemo();
  bot.replay();
});

shapeGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-shape-option]");
  if (!button) return;
  shapeInput.value = button.dataset.shapeOption;
  syncDemo();
});

sequenceList.addEventListener("click", (event) => {
  const row = event.target.closest("[data-sequence-index]");
  if (!row) return;
  const index = Number(row.dataset.sequenceIndex);
  if (event.target.closest("[data-select-sequence-step]")) {
    stopEditorSequence();
    selectedStepIndex = index;
    stateInput.value = sequence[index].state;
    renderSequence();
    syncDemo();
    bot.replay();
    return;
  }

  const action = event.target.closest("[data-sequence-action]")?.dataset.sequenceAction;
  if (!action) return;
  stopEditorSequence();
  if (action === "delete" && sequence.length > 1) {
    sequence.splice(index, 1);
    selectedStepIndex = Math.min(index, sequence.length - 1);
  } else if (action === "up" && index > 0) {
    [sequence[index - 1], sequence[index]] = [sequence[index], sequence[index - 1]];
    selectedStepIndex = index - 1;
  } else if (action === "down" && index < sequence.length - 1) {
    [sequence[index + 1], sequence[index]] = [sequence[index], sequence[index + 1]];
    selectedStepIndex = index + 1;
  }
  stateInput.value = sequence[selectedStepIndex].state;
  setCodeMode("sequence");
  renderSequence();
  syncDemo();
  bot.replay();
});

sequenceList.addEventListener("input", (event) => {
  const row = event.target.closest("[data-sequence-index]");
  if (!row) return;
  const step = sequence[Number(row.dataset.sequenceIndex)];
  if (event.target.matches("[data-step-hold]")) step.hold = Math.max(0, Math.round(Number(event.target.value || 0) * 1000));
  if (event.target.matches("[data-step-morph-hold]")) step.morphHold = Math.max(0, Math.round(Number(event.target.value || 0) * 1000));
  stopEditorSequence({ resetSummary: false });
  setCodeMode("sequence");
  syncSequenceSummary();
  syncDemo();
});

sequenceMorphGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-morph-option]");
  if (!button) return;
  stopEditorSequence();
  sequence[selectedStepIndex].morph = button.dataset.morphOption === "none" ? null : button.dataset.morphOption;
  stateInput.value = sequence[selectedStepIndex].state;
  setCodeMode("sequence");
  renderSequence();
  syncDemo();
  bot.replay();
  if (sequence[selectedStepIndex].morph) {
    bot.playMorph(sequence[selectedStepIndex].morph, {
      hold: sequence[selectedStepIndex].morphHold,
      restore: "default",
    });
  }
});

addSequenceStepButton.addEventListener("click", () => {
  stopEditorSequence();
  sequence.push({ state: "idle", hold: 1000, morph: null, morphHold: 1000 });
  selectedStepIndex = sequence.length - 1;
  stateInput.value = "idle";
  setCodeMode("sequence");
  renderSequence();
  syncDemo();
});

sequenceLoop.addEventListener("change", () => {
  stopEditorSequence();
  setCodeMode("sequence");
  syncDemo();
});

previewSequenceButton.addEventListener("click", async () => {
  stopEditorSequence();
  const run = ++sequenceRun;
  sequencePlaying = true;
  setCodeMode("sequence");
  syncSequenceSummary("准备第 1 步…");
  syncSequencePlaybackUI();
  const result = await bot.playSequence(sequence, { loop: sequenceLoop.checked });
  if (run !== sequenceRun) return;
  sequencePlaying = false;
  playingStepIndex = -1;
  syncSequencePlaybackUI();
  syncSequenceSummary(result.cancelled ? "已停止" : "播放完成 · 可再次播放");
});

stopSequenceButton.addEventListener("click", () => stopEditorSequence());

bot.addEventListener("sequencestep", (event) => {
  playingStepIndex = event.detail.index;
  stateInput.value = event.detail.state;
  syncSequenceSummary(`第 ${event.detail.index + 1} 步 · ${stateLabels[event.detail.state]}停留 ${event.detail.hold / 1000} 秒`);
  syncSequencePlaybackUI();
  syncDemo();
});

bot.addEventListener("morphstart", (event) => {
  if (!sequencePlaying) return;
  syncSequenceSummary(`第 ${playingStepIndex + 1} 步 · Morph ${effectLabels[event.detail.effect]}`);
});

document.querySelectorAll(".context-tabs [data-context]").forEach((button) => button.addEventListener("click", () => {
  previewStage.dataset.context = button.dataset.context;
  document.querySelectorAll(".context-tabs [data-context]").forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
}));

document.querySelectorAll("[data-code-mode]").forEach((button) => button.addEventListener("click", () => {
  setCodeMode(button.dataset.codeMode);
  syncDemo();
}));

pauseButton.addEventListener("click", () => {
  bot.paused = !bot.paused;
  pauseButton.textContent = bot.paused ? "继续动画" : "暂停动画";
  pauseButton.classList.toggle("is-paused", bot.paused);
});

document.querySelector("#copy-component-code").addEventListener("click", async (event) => {
  try {
    await navigator.clipboard.writeText(code.textContent);
    event.currentTarget.textContent = "已复制，可以粘贴了 ✓";
    event.currentTarget.classList.add("is-copied");
    window.setTimeout(() => {
      event.currentTarget.textContent = "复制这段代码";
      event.currentTarget.classList.remove("is-copied");
    }, 1400);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    event.currentTarget.textContent = "代码已选中，请按 ⌘C";
  }
});

let lastRuntimeUpdate = 0;
function updateRuntime(now) {
  if (now - lastRuntimeUpdate > 100) {
    const snapshot = bot.snapshot();
    if (snapshot) runtime.textContent = `E${String(snapshot.expressionIndex).padStart(2, "0")} · ${snapshot.morphPhase} · ${snapshot.morphAmount.toFixed(2)}`;
    lastRuntimeUpdate = now;
  }
  requestAnimationFrame(updateRuntime);
}

renderSequence();
syncDemo();
requestAnimationFrame(updateRuntime);
