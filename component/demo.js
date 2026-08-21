import {
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
const transitionFrom = document.querySelector("#transition-from");
const transitionTo = document.querySelector("#transition-to");
const transitionBuilder = document.querySelector("#transition-builder");
const transitionButton = document.querySelector("#preview-transition");
const transitionHint = document.querySelector("#transition-hint");
const transitionFromBot = document.querySelector("#transition-from-bot");
const transitionToBot = document.querySelector("#transition-to-bot");
const transitionFromLabel = document.querySelector("#transition-from-label");
const transitionFromCode = document.querySelector("#transition-from-code");
const transitionToLabel = document.querySelector("#transition-to-label");
const transitionToCode = document.querySelector("#transition-to-code");
const swapTransitionButton = document.querySelector("#swap-transition");
const bot = document.querySelector("#demo-bot");
const previewStage = document.querySelector("#preview-stage");
const contextTitle = document.querySelector("#context-title");
const contextDescription = document.querySelector("#context-description");
const readout = document.querySelector("#demo-readout");
const runtime = document.querySelector("#demo-runtime");
const code = document.querySelector("#component-code");
let codeMode = "static";
let activeTransitionSlot = "to";
let transitionTimer = 0;
let transitionPhaseTimer = 0;

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
transitionFrom.value = "idle";
transitionTo.value = "thinking";
stateInput.value = transitionTo.value;

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

function transitionCode() {
  const from = transitionFrom.value;
  const to = transitionTo.value;
  return `<script type="module" src="./morph-bot/morph-bot.js"></script>\n\n<button id="change-bot-state">切换到${stateLabels[to]}</button>\n\n<morph-bot\n  id="status-bot"\n  ${componentAttributes(from)}\n  label="任务状态"\n></morph-bot>\n\n<script type="module">\n  const bot = document.querySelector("#status-bot");\n\n  document.querySelector("#change-bot-state")\n    .addEventListener("click", () => {\n      bot.setState("${to}");\n    });\n</script>`;
}

function contextText(state) {
  const label = stateLabels[state];
  if (state === "idle") return ["等待任务", "状态可以随时切换"];
  if (state === "celebrate") return ["任务已完成", "结果已经准备好了"];
  if (["sad", "scared", "confused", "alerting"].includes(state)) return [`当前状态：${label}`, "你可以随时切换状态"];
  return [`正在${label}`, "通常只需要几秒钟"];
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
}

function syncTransitionUI() {
  const from = transitionFrom.value;
  const to = transitionTo.value;
  transitionBuilder.dataset.activeSlot = activeTransitionSlot;
  document.querySelectorAll("[data-transition-slot]").forEach((slot) => {
    const active = slot.dataset.transitionSlot === activeTransitionSlot;
    slot.classList.toggle("is-active", active);
    slot.setAttribute("aria-pressed", String(active));
  });

  transitionFromLabel.textContent = stateLabels[from];
  transitionFromCode.textContent = from;
  transitionToLabel.textContent = stateLabels[to];
  transitionToCode.textContent = to;
  for (const [slotBot, state] of [[transitionFromBot, from], [transitionToBot, to]]) {
    if (slotBot.state !== state) slotBot.state = state;
    if (slotBot.shape !== shapeInput.value) slotBot.shape = shapeInput.value;
    if (slotBot.getAttribute("color") !== colorInput.value) slotBot.setAttribute("color", colorInput.value);
    if (slotBot.getAttribute("eye-color") !== eyeColorInput.value) slotBot.setAttribute("eye-color", eyeColorInput.value);
  }

  const role = activeTransitionSlot === "from" ? ["起点 A", "A"] : ["终点 B", "B"];
  transitionHint.innerHTML = `<strong>正在选择${role[0]}</strong><span>点击左侧任意状态即可替换 ${role[1]}</span>`;

  stateGrid.querySelectorAll("[data-state-option]").forEach((button) => {
    const state = button.dataset.stateOption;
    const markers = [];
    if (state === from) markers.push('<i class="role-a">A</i>');
    if (state === to) markers.push('<i class="role-b">B</i>');
    button.querySelector(".state-role-markers").innerHTML = markers.join("");
    button.classList.toggle("has-transition-role", markers.length > 0);
  });
}

function setCodeMode(mode) {
  codeMode = mode;
  document.querySelectorAll("[data-code-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.codeMode === codeMode));
}

function cancelTransitionPlayback() {
  window.clearTimeout(transitionTimer);
  window.clearTimeout(transitionPhaseTimer);
  transitionBuilder.dataset.phase = "ready";
  transitionButton.disabled = false;
  transitionButton.innerHTML = "<span>▶</span> 播放 A → B";
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
  syncTransitionUI();
  code.textContent = codeMode === "transition" ? transitionCode() : staticCode();
  stateGrid.querySelectorAll("[data-state-option]").forEach((button) => button.classList.toggle("is-active", button.dataset.stateOption === stateInput.value));
  shapeGrid.querySelectorAll("[data-shape-option]").forEach((button) => button.classList.toggle("is-active", button.dataset.shapeOption === shapeInput.value));
  syncThumbnailAppearance();
}

[sizeInput, colorInput, eyeColorInput, speedSelect, pointerInput].forEach((input) => input.addEventListener("input", syncDemo));

stateGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-state-option]");
  if (!button) return;
  cancelTransitionPlayback();
  stateInput.value = button.dataset.stateOption;
  if (activeTransitionSlot === "from") transitionFrom.value = stateInput.value;
  else transitionTo.value = stateInput.value;
  setCodeMode("transition");
  syncDemo();
  bot.replay();
});

document.querySelectorAll("[data-transition-slot]").forEach((slot) => slot.addEventListener("click", () => {
  cancelTransitionPlayback();
  activeTransitionSlot = slot.dataset.transitionSlot;
  stateInput.value = activeTransitionSlot === "from" ? transitionFrom.value : transitionTo.value;
  syncDemo();
  bot.replay();
}));

swapTransitionButton.addEventListener("click", () => {
  cancelTransitionPlayback();
  const previousFrom = transitionFrom.value;
  transitionFrom.value = transitionTo.value;
  transitionTo.value = previousFrom;
  activeTransitionSlot = "to";
  stateInput.value = transitionTo.value;
  setCodeMode("transition");
  syncDemo();
  bot.replay();
});

shapeGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-shape-option]");
  if (!button) return;
  shapeInput.value = button.dataset.shapeOption;
  syncDemo();
});

document.querySelectorAll(".context-tabs [data-context]").forEach((button) => button.addEventListener("click", () => {
  previewStage.dataset.context = button.dataset.context;
  document.querySelectorAll(".context-tabs [data-context]").forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
}));

document.querySelectorAll("[data-code-mode]").forEach((button) => button.addEventListener("click", () => {
  setCodeMode(button.dataset.codeMode);
  syncDemo();
}));

transitionButton.addEventListener("click", () => {
  cancelTransitionPlayback();
  setCodeMode("transition");
  activeTransitionSlot = "to";
  transitionBuilder.dataset.phase = "a";
  stateInput.value = transitionFrom.value;
  syncDemo();
  bot.replay();
  transitionButton.disabled = true;
  transitionButton.textContent = `A · ${stateLabels[transitionFrom.value]}`;
  transitionTimer = window.setTimeout(() => {
    transitionBuilder.dataset.phase = "switch";
    stateInput.value = transitionTo.value;
    syncDemo();
    bot.replay();
    transitionButton.textContent = "正在切换…";
    transitionPhaseTimer = window.setTimeout(() => {
      transitionBuilder.dataset.phase = "b";
      transitionButton.disabled = false;
      transitionButton.innerHTML = "<span>↻</span> 再次播放 A → B";
    }, 500);
  }, 700);
});

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

syncDemo();
requestAnimationFrame(updateRuntime);
