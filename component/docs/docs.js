import {
  MORPH_BOT_EFFECTS,
  MORPH_BOT_SHAPES,
  MORPH_BOT_STATES,
} from "../morph-bot.js";

const stateGroups = [
  { label: "基础状态", states: ["idle", "sleeping", "waking", "listening", "thinking", "searching", "working"] },
  { label: "情绪反应", states: ["excited", "surprised", "suspicious", "angry", "drowsy", "happy", "curious", "confused", "bored", "proud", "shy", "sad", "laughing", "scared", "playful", "celebrate"] },
  { label: "Agent 形变", states: ["orbit", "radar", "progress"] },
  { label: "任务状态", states: ["spawning", "humming", "loading", "dictating", "writing", "sending", "receiving", "uploading", "notifying", "alerting", "dragging", "bouncing", "powering-down"] },
];

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

const effectDescriptions = {
  dots: "思考点阵", orbit: "彩色轨道", radar: "雷达扫描", progress: "循环进度", gather: "聚合生成", wave: "声音波形", send: "向外发送",
  receive: "接收进入", dock: "上传停靠", ball: "弹跳球体", whirl: "旋转加载", pencil: "书写铅笔", bang: "警报符号", standby: "待机关机",
};

const bot = document.querySelector("#docs-bot");
const stateSelect = document.querySelector("#docs-state");
const shapeSelect = document.querySelector("#docs-shape");
const effectSelect = document.querySelector("#docs-effect");
const snapshotOutput = document.querySelector("#live-snapshot");
const pauseButton = document.querySelector("#toggle-pause");

const orderedStates = ["idle", ...MORPH_BOT_STATES.filter((state) => state !== "idle")];
for (const state of orderedStates) stateSelect.add(new Option(`${stateLabels[state]} · ${state}`, state));
for (const shape of MORPH_BOT_SHAPES) shapeSelect.add(new Option(`${shapeLabels[shape]} · ${shape}`, shape));
for (const effect of MORPH_BOT_EFFECTS) effectSelect.add(new Option(`${effectDescriptions[effect]} · ${effect}`, effect));
stateSelect.value = "idle";
shapeSelect.value = "blob";
effectSelect.value = "dots";

const stateReference = document.querySelector("#state-reference");
for (const group of stateGroups) {
  const section = document.createElement("section");
  section.className = "reference-group";
  const heading = document.createElement("h3");
  heading.textContent = `${group.label} · ${group.states.length}`;
  const grid = document.createElement("div");
  grid.className = "state-reference";
  for (const state of group.states) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.docsState = state;
    button.innerHTML = `<strong>${stateLabels[state]}</strong><code>${state}</code>`;
    grid.append(button);
  }
  section.append(heading, grid);
  stateReference.append(section);
}

const shapeReference = document.querySelector("#shape-reference");
for (const shape of MORPH_BOT_SHAPES) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.docsShape = shape;
  const preview = document.createElement("morph-bot");
  preview.setAttribute("state", "idle");
  preview.setAttribute("shape", shape);
  preview.setAttribute("size", "44");
  preview.setAttribute("decorative", "");
  preview.setAttribute("thumbnail", "");
  const label = document.createElement("span");
  label.innerHTML = `<strong>${shapeLabels[shape]}</strong><code>${shape}</code>`;
  button.append(preview, label);
  shapeReference.append(button);
}

const effectReference = document.querySelector("#effect-reference");
for (const effect of MORPH_BOT_EFFECTS) {
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.docsEffect = effect;
  button.innerHTML = `<strong>${effect}</strong><span>${effectDescriptions[effect]}</span><i>▶</i>`;
  effectReference.append(button);
}

function applyState() {
  bot.setState(stateSelect.value, { replay: true });
  bot.setShape(shapeSelect.value);
}

document.querySelector("#apply-state").addEventListener("click", applyState);
document.querySelector("#replay-state").addEventListener("click", () => bot.replay());
document.querySelector("#play-morph").addEventListener("click", () => bot.playMorph(effectSelect.value, { hold: 1200, restore: "default" }));
pauseButton.addEventListener("click", () => {
  bot.paused = !bot.paused;
  pauseButton.textContent = bot.paused ? "继续" : "暂停";
});

stateReference.addEventListener("click", (event) => {
  const button = event.target.closest("[data-docs-state]");
  if (!button) return;
  stateSelect.value = button.dataset.docsState;
  applyState();
  document.querySelector(".live-api").scrollIntoView({ behavior: "smooth", block: "nearest" });
});

shapeReference.addEventListener("click", (event) => {
  const button = event.target.closest("[data-docs-shape]");
  if (!button) return;
  shapeSelect.value = button.dataset.docsShape;
  applyState();
});

effectReference.addEventListener("click", (event) => {
  const button = event.target.closest("[data-docs-effect]");
  if (!button) return;
  effectSelect.value = button.dataset.docsEffect;
  bot.playMorph(effectSelect.value, { hold: 1200, restore: "default" });
});

document.querySelectorAll("[data-copy-code]").forEach((button) => button.addEventListener("click", async () => {
  const source = button.closest(".code-block").querySelector("code").textContent;
  try {
    await navigator.clipboard.writeText(source);
    button.textContent = "已复制";
    button.classList.add("is-copied");
    window.setTimeout(() => {
      button.textContent = "复制";
      button.classList.remove("is-copied");
    }, 1200);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(button.closest(".code-block").querySelector("code"));
    selection.removeAllRanges();
    selection.addRange(range);
    button.textContent = "已选中";
  }
}));

const navLinks = [...document.querySelectorAll(".docs-nav a")];
const sections = navLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
if (globalThis.IntersectionObserver) {
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`));
  }, { rootMargin: "-18% 0px -68%", threshold: [0, 0.2, 0.6] });
  sections.forEach((section) => observer.observe(section));
}

let lastSnapshot = 0;
function updateSnapshot(now) {
  if (now - lastSnapshot > 180) {
    const snapshot = bot.snapshot();
    if (snapshot) {
      snapshotOutput.textContent = JSON.stringify({
        state: snapshot.state,
        expressionIndex: snapshot.expressionIndex,
        eyeOpen: Number(snapshot.eyeOpen.toFixed(2)),
        morphEffect: snapshot.morphEffect,
        morphAmount: Number(snapshot.morphAmount.toFixed(2)),
        morphPhase: snapshot.morphPhase,
        paused: snapshot.paused,
      }, null, 2);
    }
    lastSnapshot = now;
  }
  requestAnimationFrame(updateSnapshot);
}

requestAnimationFrame(updateSnapshot);
