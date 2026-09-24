import { GrokBotEngine } from "../grok-bot-engine.js";
import { ORIGINAL_STATE_DATA } from "../original-data.js";
import { MORPH_BY_STATE, STATE_CATALOG } from "../component/catalog.js";
import { DEFAULT_MATERIAL } from "../component/materials.js";
import { WIDTH, HEIGHT, drawStroke, renderActions, parseProject } from "./model.js";
import { createRecorder } from "./recorder.js";

const $ = selector => document.querySelector(selector);
const canvas = $("#draw-canvas");
const ctx = canvas.getContext("2d");
const committed = document.createElement("canvas");
committed.width = WIDTH;
committed.height = HEIGHT;
const committedCtx = committed.getContext("2d");
const captureCanvas = $("#capture-canvas");
const captureCtx = captureCanvas.getContext("2d");
const stage = $("#paint-stage");
const content = $("#stage-content");
const position = $("#drippy-position");
const svg = $("#drippy-bot");
const states = new Set(STATE_CATALOG.map(state => state.id));
const mobileSettings = matchMedia("(max-width: 760px)");
$("#tool-settings").open = !mobileSettings.matches;
mobileSettings.addEventListener("change", event => { $("#tool-settings").open = !event.matches; });
const storageKey = "drippy-paint-studio-v1";
const character = { ...DEFAULT_MATERIAL, color: "#fec832", eyeColor: "#111111", size: 250, flipX: false, pointer: true, halo: "soft", badgeColor: "#fec832", badgeScale: 1, particlesEnabled: true };

let actions = [];
let redo = [];
let draft = null;
let tool = "pen";
let baseState = "idle";
let runtimeState = "idle";
let zoom = 1;
let pan = { x: 0, y: 0 };
let panDrag = null;
let botDrag = null;
let lastClient = null;
let lastPoint = null;
let lastMoveAt = 0;
let lastTimelineMove = 0;
let reactionUntil = 0;
let reactionPriority = 0;
let reactionCooldown = 0;
let reactionTimer = null;
let timelineOrigin = performance.now();
let timeline = { version: 1, duration: 0, events: [] };
let drawingFrame = 0;
let animationFrame = 0;
let snapshotPromise = null;
let snapshotImage = null;
let lastSnapshotAt = 0;

function recordEvent(type, data = {}) {
  if (timeline.events.length >= 10000) return;
  const time = Math.round((performance.now() - timelineOrigin) / 10) / 100;
  timeline.events.push({ time, type, ...data });
  timeline.duration = time;
}

function configForState(id) {
  const blink = ORIGINAL_STATE_DATA.BLINK_CADENCE[id];
  return {
    ...character, interactive: false, shape: "blob",
    expressionPool: [...ORIGINAL_STATE_DATA.EXPRESSION_POOLS[id]], expressionWeights: {},
    expressionCadence: [...ORIGINAL_STATE_DATA.EXPRESSION_CADENCE[id]],
    blinkCadence: $("#blink").checked && blink ? [Math.min(...blink), Math.max(...blink)] : null,
    morph: ["thinking", "dictating"].includes(id) ? "none" : MORPH_BY_STATE[id] || "none",
    headX: 0, headY: 0, headRotation: 0, scaleX: 1, scaleY: 1, eyeOpen: 1,
    eyeScale: 1, gazeScale: 1, motionScale: 1, tempo: 1,
  };
}

const engine = new GrokBotEngine(svg, () => configForState(runtimeState));
const REACTIONS = {
  drawing: { state: "working", priority: 1, duration: 950 },
  fast: { state: "excited", priority: 2, duration: 850 },
  near: { state: "surprised", priority: 3, duration: 900 },
  erase: { state: "curious", priority: 2, duration: 800 },
  clear: { state: "surprised", priority: 4, duration: 1150 },
  click: { state: "playful", priority: 4, duration: 1050 },
  done: { state: "happy", priority: 1, duration: 700 },
};

function setRuntimeState(id) {
  if (!states.has(id) || id === runtimeState) return;
  runtimeState = id;
  engine.setState(id, false);
  $("#reaction-status").textContent = `Drippy: ${id}`;
  recordEvent("drippy.state", { state: id });
}

function react(kind) {
  if (!$("#react-drawing").checked || !$("#show-drippy").checked) return;
  const reaction = REACTIONS[kind];
  const now = performance.now();
  if (!reaction || (now < reactionUntil && reaction.priority < reactionPriority) || (now < reactionCooldown && reaction.state === runtimeState)) return;
  reactionPriority = reaction.priority;
  reactionUntil = now + reaction.duration;
  reactionCooldown = now + 260;
  setRuntimeState(reaction.state);
  clearTimeout(reactionTimer);
  reactionTimer = setTimeout(() => { reactionPriority = 0; setRuntimeState(baseState); }, reaction.duration);
}

for (const state of STATE_CATALOG) {
  const option = document.createElement("option");
  option.value = state.id;
  option.textContent = state.en || state.id;
  $("#base-state").append(option);
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: clamp((event.clientX - rect.left) * WIDTH / rect.width, 0, WIDTH), y: clamp((event.clientY - rect.top) * HEIGHT / rect.height, 0, HEIGHT), p: event.pointerType === "pen" ? clamp(event.pressure || .5, .1, 1) : 1 };
}

function scheduleDraw() {
  if (!drawingFrame) drawingFrame = requestAnimationFrame(() => {
    drawingFrame = 0;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.drawImage(committed, 0, 0);
    if (draft) drawStroke(ctx, draft);
    let visibleStrokes = 0;
    for (const action of actions) visibleStrokes = action.kind === "clear" ? 0 : visibleStrokes + 1;
    $("#stroke-count").textContent = `${visibleStrokes} ${visibleStrokes === 1 ? "traço" : "traços"}`;
    $("#undo-button").disabled = !actions.length;
    $("#redo-button").disabled = !redo.length;
  });
}

function rebuild() {
  renderActions(committedCtx, actions);
  scheduleDraw();
}

function applyView() {
  content.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  $("#zoom").value = String(Math.round(zoom * 100));
  $("#zoom-value").textContent = `${Math.round(zoom * 100)}%`;
}

function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(projectData())); $("#save-status").textContent = "salvo"; }
  catch { $("#save-status").textContent = "não salvo"; }
}

function commit(action) {
  actions.push(action);
  redo = [];
  if (action.kind === "clear") committedCtx.clearRect(0, 0, WIDTH, HEIGHT);
  else drawStroke(committedCtx, action.stroke);
  scheduleDraw();
  persist();
}

canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  lastClient = { x: event.clientX, y: event.clientY };
  if (tool === "pan") { panDrag = { x: event.clientX, y: event.clientY, pan: { ...pan } }; return; }
  const point = pointFromEvent(event);
  lastPoint = point;
  lastMoveAt = performance.now();
  draft = { tool, color: $("#brush-color").value, size: Number($("#brush-size").value), pressure: $("#use-pressure").checked && ["brush", "eraser"].includes(tool), points: [point] };
  recordEvent("brush.start", { x: point.x, y: point.y, tool });
  const x = Number($("#drippy-x").value) * WIDTH / 100;
  const y = Number($("#drippy-y").value) * HEIGHT / 100;
  react(Math.hypot(point.x - x, point.y - y) < Number($("#drippy-size").value) * .6 ? "near" : tool === "eraser" ? "erase" : "drawing");
  scheduleDraw();
});

canvas.addEventListener("pointermove", event => {
  lastClient = { x: event.clientX, y: event.clientY };
  if (panDrag) {
    pan = { x: panDrag.pan.x + event.clientX - panDrag.x, y: panDrag.pan.y + event.clientY - panDrag.y };
    applyView();
    return;
  }
  if (!draft) return;
  const point = pointFromEvent(event);
  const prior = lastPoint;
  const now = performance.now();
  if (["pen", "brush", "eraser"].includes(tool)) {
    if (Math.hypot(point.x - prior.x, point.y - prior.y) < 1) return;
    draft.points.push(point);
  } else draft.points[1] = point;
  const speed = Math.hypot(point.x - prior.x, point.y - prior.y) / Math.max(1, now - lastMoveAt);
  lastPoint = point;
  lastMoveAt = now;
  if (now - lastTimelineMove > 40) { recordEvent("brush.move", { x: point.x, y: point.y }); lastTimelineMove = now; }
  const x = Number($("#drippy-x").value) * WIDTH / 100;
  const y = Number($("#drippy-y").value) * HEIGHT / 100;
  if (Math.hypot(point.x - x, point.y - y) < Number($("#drippy-size").value) * .55) react("near");
  else if (speed > 3) react("fast");
  scheduleDraw();
});

function finishStroke(event) {
  if (panDrag) { panDrag = null; return; }
  if (!draft) return;
  const stroke = draft;
  draft = null;
  recordEvent("brush.end", { x: lastPoint.x, y: lastPoint.y });
  commit({ kind: "stroke", stroke });
  react("done");
}
canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointercancel", finishStroke);

function selectTool(next) {
  tool = next;
  document.querySelectorAll(".tool").forEach(button => {
    const active = button.dataset.tool === tool;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  recordEvent("tool.change", { tool });
  persist();
}
document.querySelectorAll(".tool").forEach(button => button.addEventListener("click", () => selectTool(button.dataset.tool)));
$("#brush-color").addEventListener("input", () => { recordEvent("color.change", { color: $("#brush-color").value }); persist(); });
$("#brush-size").addEventListener("input", () => { $("#brush-size-value").textContent = `${$("#brush-size").value} px`; persist(); });
$("#zoom").addEventListener("input", () => { zoom = Number($("#zoom").value) / 100; applyView(); persist(); });
$("#reset-view").addEventListener("click", () => { zoom = 1; pan = { x: 0, y: 0 }; applyView(); persist(); });
$("#background").addEventListener("change", () => { stage.classList.toggle("is-transparent", $("#background").value === "transparent"); persist(); });
$("#use-pressure").addEventListener("change", persist);

$("#undo-button").addEventListener("click", () => { if (actions.length) { redo.push(actions.pop()); recordEvent("undo"); rebuild(); persist(); } });
$("#redo-button").addEventListener("click", () => { if (redo.length) { actions.push(redo.pop()); recordEvent("redo"); rebuild(); persist(); } });
$("#clear-button").addEventListener("click", () => { if (actions.length && actions.at(-1)?.kind !== "clear") { recordEvent("clear"); commit({ kind: "clear" }); react("clear"); } });

document.addEventListener("keydown", event => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); $(event.shiftKey ? "#redo-button" : "#undo-button").click(); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); $("#redo-button").click(); }
});

$("#base-state").addEventListener("change", () => { baseState = $("#base-state").value; clearTimeout(reactionTimer); setRuntimeState(baseState); persist(); });

function applyBotLayout() {
  const size = Number($("#drippy-size").value);
  character.size = size;
  position.style.width = `${size / WIDTH * 100}%`;
  position.style.left = `${$("#drippy-x").value}%`;
  position.style.top = `${$("#drippy-y").value}%`;
  position.hidden = !$("#show-drippy").checked;
  position.classList.toggle("is-locked", $("#lock-drippy").checked);
  $("#drippy-size-value").textContent = `${size} px`;
}

for (const id of ["drippy-size", "drippy-x", "drippy-y"]) $("#" + id).addEventListener("input", () => { applyBotLayout(); recordEvent("drippy.position", { x: Number($("#drippy-x").value), y: Number($("#drippy-y").value) }); persist(); });
for (const id of ["show-drippy", "follow-brush", "react-drawing", "blink", "lock-drippy"]) $("#" + id).addEventListener("change", () => { applyBotLayout(); persist(); });
$("#reset-drippy").addEventListener("click", () => { $("#drippy-x").value = "70"; $("#drippy-y").value = "58"; applyBotLayout(); recordEvent("drippy.position", { x: 70, y: 58 }); persist(); });

position.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  position.setPointerCapture(event.pointerId);
  botDrag = { x: event.clientX, y: event.clientY, bx: Number($("#drippy-x").value), by: Number($("#drippy-y").value), moved: false };
  position.classList.add("is-dragging");
});
position.addEventListener("pointermove", event => {
  if (!botDrag || $("#lock-drippy").checked) return;
  const rect = content.getBoundingClientRect();
  const dx = event.clientX - botDrag.x;
  const dy = event.clientY - botDrag.y;
  botDrag.moved ||= Math.hypot(dx, dy) > 4;
  $("#drippy-x").value = String(Math.round(clamp(botDrag.bx + dx / rect.width * 100, 0, 100)));
  $("#drippy-y").value = String(Math.round(clamp(botDrag.by + dy / rect.height * 100, 0, 100)));
  applyBotLayout();
});
function finishBotDrag() {
  if (!botDrag) return;
  if (botDrag.moved) { recordEvent("drippy.position", { x: Number($("#drippy-x").value), y: Number($("#drippy-y").value) }); persist(); }
  else react("click");
  botDrag = null;
  position.classList.remove("is-dragging");
}
position.addEventListener("pointerup", finishBotDrag);
position.addEventListener("pointercancel", finishBotDrag);
position.addEventListener("keydown", event => {
  if (["Enter", " "].includes(event.key)) { event.preventDefault(); react("click"); return; }
  if ($("#lock-drippy").checked || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
  event.preventDefault();
  const id = ["ArrowLeft", "ArrowRight"].includes(event.key) ? "drippy-x" : "drippy-y";
  $("#" + id).value = String(clamp(Number($("#" + id).value) + (["ArrowLeft", "ArrowUp"].includes(event.key) ? -1 : 1), 0, 100));
  applyBotLayout();
  recordEvent("drippy.position", { x: Number($("#drippy-x").value), y: Number($("#drippy-y").value) });
  persist();
});

function projectData() {
  return {
    version: 1, canvas: { width: WIDTH, height: HEIGHT }, actions, tool,
    brush: { color: $("#brush-color").value, size: Number($("#brush-size").value) },
    background: $("#background").value, zoom, baseState,
    drippy: {
      x: Number($("#drippy-x").value), y: Number($("#drippy-y").value), size: Number($("#drippy-size").value),
      visible: $("#show-drippy").checked, follow: $("#follow-brush").checked,
      reactions: $("#react-drawing").checked, blink: $("#blink").checked,
      locked: $("#lock-drippy").checked, pressure: $("#use-pressure").checked,
    },
    timeline: { ...timeline, duration: Math.round((performance.now() - timelineOrigin) / 10) / 100 },
  };
}

function applyProject(raw) {
  const data = parseProject(raw);
  actions = data.actions;
  redo = [];
  draft = null;
  timeline = data.timeline;
  timelineOrigin = performance.now() - timeline.duration * 1000;
  tool = data.tool;
  baseState = states.has(data.baseState) ? data.baseState : "idle";
  $("#base-state").value = baseState;
  $("#brush-color").value = data.brush.color;
  $("#brush-size").value = String(data.brush.size);
  $("#brush-size-value").textContent = `${data.brush.size} px`;
  $("#background").value = data.background;
  stage.classList.toggle("is-transparent", data.background === "transparent");
  zoom = data.zoom;
  pan = { x: 0, y: 0 };
  for (const [id, key] of [["drippy-x", "x"], ["drippy-y", "y"], ["drippy-size", "size"]]) $("#" + id).value = String(data.drippy[key]);
  for (const [id, key] of [["show-drippy", "visible"], ["follow-brush", "follow"], ["react-drawing", "reactions"], ["blink", "blink"], ["lock-drippy", "locked"], ["use-pressure", "pressure"]]) $("#" + id).checked = data.drippy[key];
  applyView();
  applyBotLayout();
  selectTool(tool);
  setRuntimeState(baseState);
  rebuild();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
$("#export-project").addEventListener("click", () => downloadBlob(new Blob([JSON.stringify(projectData(), null, 2)], { type: "application/json" }), `drippy-paint-${Date.now()}.drippypaint.json`));
$("#import-project").addEventListener("change", async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 8_000_000) throw new Error("Arquivo maior que 8 MB");
    const data = JSON.parse(await file.text());
    parseProject(data);
    applyProject(data);
    persist();
  } catch (error) { $("#record-message").textContent = `Não foi possível abrir o projeto: ${error.message}`; }
  finally { event.target.value = ""; }
});

const embeddedSvgCss = `
  .grok-bot-mark__head,.morph-part{fill:var(--fg,#f3f3f3)}
  .grok-bot-mark__eye,.drippy-eye,.drippy-mouth-open{fill:var(--bg,#111)}
  .eye-path{display:none}.drippy-ear{fill:none;stroke:var(--bg,#111);stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round}
  .drippy-mouth{fill:none;stroke:var(--bg,#111);stroke-width:4;stroke-linecap:round}
  .morph-ring{fill:none;stroke:var(--fg,#f3f3f3)}.morph-glyph{fill:var(--fg,#f3f3f3)}
  [hidden]{display:none!important}`;

function refreshSnapshot(force = false) {
  if (position.hidden) return Promise.resolve(null);
  if (snapshotPromise) return snapshotPromise;
  if (!force && performance.now() - lastSnapshotAt < 35) return Promise.resolve(snapshotImage);
  lastSnapshotAt = performance.now();
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "259");
  clone.setAttribute("height", "259");
  clone.setAttribute("style", "--fg:#fec832;--bg:#111");
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = embeddedSvgCss;
  clone.querySelector("defs")?.append(style);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  snapshotPromise = new Promise(resolve => {
    const image = new Image();
    image.onload = () => { snapshotImage = image; URL.revokeObjectURL(url); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    image.src = url;
  }).finally(() => { snapshotPromise = null; });
  return snapshotPromise;
}

function renderComposite({ video = false, withDrippy = true } = {}) {
  captureCtx.clearRect(0, 0, WIDTH, HEIGHT);
  if ($("#background").value === "white" || video) {
    captureCtx.fillStyle = $("#background").value === "white" ? "#fff" : "#121212";
    captureCtx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  captureCtx.drawImage(canvas, 0, 0);
  if (withDrippy && !position.hidden && snapshotImage?.complete) {
    const size = Number($("#drippy-size").value);
    const x = Number($("#drippy-x").value) * WIDTH / 100 - size / 2;
    const y = Number($("#drippy-y").value) * HEIGHT / 100 - size / 2;
    captureCtx.drawImage(snapshotImage, x, y, size, size);
  }
}

$("#export-png").addEventListener("click", async () => {
  const withDrippy = $("#png-content").value === "combined";
  if (withDrippy) await refreshSnapshot(true);
  renderComposite({ withDrippy });
  captureCanvas.toBlob(blob => { if (blob) downloadBlob(blob, `drippy-paint-${Date.now()}.png`); }, "image/png");
});

const preview = $("#recording-preview");
const download = $("#download-recording");
const recorder = createRecorder(captureCanvas, (state, seconds) => {
  const total = Math.floor(seconds);
  $("#record-timer").textContent = `${String(Math.floor(total / 3600)).padStart(2, "0")}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  $("#record-button").hidden = state !== "inactive";
  $("#pause-button").hidden = state === "inactive";
  $("#pause-button").textContent = state === "paused" ? "Continuar" : "Pausar";
  $("#stop-button").hidden = state === "inactive";
  $("#discard-button").hidden = state === "inactive";
  $("#record-message").textContent = state === "recording" ? "Gravando desenho e Drippy" : state === "paused" ? "Gravação pausada" : "Pronto para gravar";
}, url => {
  preview.hidden = !url;
  download.hidden = !url;
  if (url) { preview.src = url; download.href = url; }
  else { preview.removeAttribute("src"); preview.load(); download.removeAttribute("href"); }
  download.download = `drippy-paint-${Date.now()}.webm`;
});

$("#record-button").addEventListener("click", async () => {
  try {
    await refreshSnapshot(true);
    renderComposite({ video: true });
    await recorder.start($("#record-mic").checked);
  } catch (error) { $("#record-message").textContent = error.message; }
});
$("#pause-button").addEventListener("click", () => recorder.state === "paused" ? recorder.resume() : recorder.pause());
$("#stop-button").addEventListener("click", () => recorder.stop());
$("#discard-button").addEventListener("click", () => recorder.discard());

function frame() {
  engine.pointer.active = $("#follow-brush").checked && Boolean(lastClient);
  if (lastClient) { engine.pointer.clientX = lastClient.x; engine.pointer.clientY = lastClient.y; }
  if (recorder.state === "recording") { renderComposite({ video: true }); refreshSnapshot(); }
  animationFrame = requestAnimationFrame(frame);
}

try {
  const raw = localStorage.getItem(storageKey);
  if (raw) applyProject(JSON.parse(raw));
} catch { $("#save-status").textContent = "projeto local incompatível"; }
$("#base-state").value = baseState;
applyView();
applyBotLayout();
rebuild();
recordEvent("drippy.state", { state: baseState });
frame();

window.addEventListener("beforeunload", () => {
  clearTimeout(reactionTimer);
  cancelAnimationFrame(animationFrame);
  cancelAnimationFrame(drawingFrame);
  recorder.destroy();
  engine.destroy();
});
