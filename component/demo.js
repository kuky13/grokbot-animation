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

const stateSelect = document.querySelector("#demo-state");
const shapeSelect = document.querySelector("#demo-shape");
const sizeInput = document.querySelector("#demo-size");
const sizeOutput = document.querySelector("#demo-size-output");
const colorInput = document.querySelector("#demo-color");
const eyeColorInput = document.querySelector("#demo-eye-color");
const speedSelect = document.querySelector("#demo-speed");
const pointerInput = document.querySelector("#demo-pointer");
const pauseButton = document.querySelector("#demo-pause");
const bot = document.querySelector("#demo-bot");
const readout = document.querySelector("#demo-readout");
const runtime = document.querySelector("#demo-runtime");
const code = document.querySelector("#component-code");

for (const state of MORPH_BOT_STATES) stateSelect.add(new Option(`${stateLabels[state]} · ${state}`, state));
for (const shape of MORPH_BOT_SHAPES) shapeSelect.add(new Option(`${shapeLabels[shape]} · ${shape}`, shape));
stateSelect.value = "loading";
shapeSelect.value = "blob";

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;");
}

function generatedCode() {
  const attributes = [
    `state="${escapeAttribute(stateSelect.value)}"`,
    `shape="${escapeAttribute(shapeSelect.value)}"`,
    `size="${sizeInput.value}"`,
    `color="${escapeAttribute(colorInput.value)}"`,
  ];
  if (eyeColorInput.value.toLowerCase() !== "#ffffff") attributes.push(`eye-color="${escapeAttribute(eyeColorInput.value)}"`);
  if (speedSelect.value !== "1") attributes.push(`speed="${speedSelect.value}"`);
  if (pointerInput.checked) attributes.push("follow-pointer");
  return `<script type="module" src="/component/morph-bot.js"></script>\n\n<morph-bot\n  ${attributes.join("\n  ")}\n  label="${stateLabels[stateSelect.value]}动画"\n></morph-bot>`;
}

function syncDemo() {
  bot.state = stateSelect.value;
  bot.shape = shapeSelect.value;
  bot.size = Number(sizeInput.value);
  bot.setAttribute("color", colorInput.value);
  bot.setAttribute("eye-color", eyeColorInput.value);
  bot.speed = Number(speedSelect.value);
  bot.toggleAttribute("follow-pointer", pointerInput.checked);
  sizeOutput.textContent = `${sizeInput.value}px`;
  readout.textContent = `${stateSelect.value} · ${shapeSelect.value}`;
  code.textContent = generatedCode();
  document.querySelectorAll("[data-preset]").forEach((button) => button.classList.toggle("is-active", button.dataset.preset === stateSelect.value));
}

[stateSelect, shapeSelect, sizeInput, colorInput, eyeColorInput, speedSelect, pointerInput].forEach((input) => input.addEventListener("input", syncDemo));

document.querySelectorAll("[data-preset]").forEach((button) => button.addEventListener("click", () => {
  stateSelect.value = button.dataset.preset;
  syncDemo();
  bot.replay();
}));

pauseButton.addEventListener("click", () => {
  bot.paused = !bot.paused;
  pauseButton.textContent = bot.paused ? "继续动画" : "暂停动画";
  pauseButton.classList.toggle("is-paused", bot.paused);
});

document.querySelector("#copy-component-code").addEventListener("click", async (event) => {
  try {
    await navigator.clipboard.writeText(code.textContent);
    event.currentTarget.textContent = "已复制";
    window.setTimeout(() => { event.currentTarget.textContent = "复制代码"; }, 1200);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    event.currentTarget.textContent = "已选中，请复制";
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
