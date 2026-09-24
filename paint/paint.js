import { GrokBotEngine } from "../grok-bot-engine.js";
import { ORIGINAL_STATE_DATA } from "../original-data.js";
import { MORPH_BY_STATE, STATE_CATALOG } from "../component/catalog.js";
import { DEFAULT_MATERIAL, SOLID_PRESETS, GRADIENT_PRESETS, GLASS_PRESETS } from "../component/materials.js";
import { createSpeechMeter } from "../component/runtime/speech-meter.js";
import { WIDTH, HEIGHT, drawStroke, moveRegion, renderActions, parseProject } from "./model.js";
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
let bitmapSources = new Map();
let bitmapImages = new Map();
let internalClipboard = null;
let draft = null;
let selection = null;
let selectionDrag = null;
let selectionPreview = null;
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
let botPose = { x: 70, y: 58 };
let roamTarget = null;
let roamAt = performance.now();
let roamPausedUntil = 0;
let audioUrl = null;
let audioName = "";
let audioContext = null;
let audioSource = null;
let audioBus = null;
let audioGain = null;
let audioMix = null;
let audioMeter = null;
let microphone = null;
let microphoneSource = null;
let lastAudioGesture = 0;

function recordEvent(type, data = {}) {
  if (timeline.events.length >= 10000) return;
  const time = Math.round((performance.now() - timelineOrigin) / 10) / 100;
  timeline.events.push({ time, type, ...data });
  timeline.duration = time;
}

function configForState(id) {
  const blink = ORIGINAL_STATE_DATA.BLINK_CADENCE[id];
  return {
    ...character, pointer: $("#follow-brush").checked, interactive: false, shape: "blob",
    expressionPool: [...ORIGINAL_STATE_DATA.EXPRESSION_POOLS[id]], expressionWeights: {},
    expressionCadence: [...ORIGINAL_STATE_DATA.EXPRESSION_CADENCE[id]],
    blinkCadence: $("#blink").checked && blink ? [Math.min(...blink), Math.max(...blink)] : null,
    morph: ["thinking", "dictating"].includes(id) ? "none" : MORPH_BY_STATE[id] || "none",
    headX: 0, headY: 0, headRotation: 0, scaleX: 1, scaleY: 1, eyeOpen: 1,
    eyeScale: 1, gazeScale: 1, motionScale: 1, tempo: 1,
  };
}

const engine = new GrokBotEngine(svg, () => configForState(runtimeState));
const materialModes = { solid: SOLID_PRESETS, gradient: GRADIENT_PRESETS, "rainbow-glass": GLASS_PRESETS };

function syncMaterialControls() {
  const mode = character.material;
  $("#material-mode").value = mode;
  const preset = $("#material-preset");
  preset.replaceChildren();
  if (mode !== "rainbow-glass") preset.add(new Option("Personalizado", "custom"));
  for (const item of materialModes[mode]) preset.add(new Option(item.label.en, item.id));
  preset.value = mode === "solid" ? SOLID_PRESETS.find(item => item.color === character.color)?.id || "custom" : mode === "gradient" ? character.gradientPreset : character.glassPreset;
  $("#solid-options").hidden = mode !== "solid";
  $("#gradient-options").hidden = mode !== "gradient" || character.gradientPreset !== "custom";
  $("#material-color").value = character.color;
  $("#gradient-start").value = character.gradientStart;
  $("#gradient-end").value = character.gradientEnd;
  $("#gradient-angle").value = String(character.gradientAngle);
  $("#eye-color").value = character.eyeColor;
  $("#badge-color").value = character.badgeColor;
}

$("#material-mode").addEventListener("change", () => {
  character.material = $("#material-mode").value;
  syncMaterialControls(); persist(); refreshSnapshot(true);
});
$("#material-preset").addEventListener("change", () => {
  const id = $("#material-preset").value;
  if (character.material === "solid" && id !== "custom") character.color = SOLID_PRESETS.find(item => item.id === id).color;
  if (character.material === "gradient") character.gradientPreset = id;
  if (character.material === "rainbow-glass") character.glassPreset = id;
  syncMaterialControls(); persist(); refreshSnapshot(true);
});
for (const [id, key] of [["material-color", "color"], ["gradient-start", "gradientStart"], ["gradient-end", "gradientEnd"], ["gradient-angle", "gradientAngle"], ["eye-color", "eyeColor"], ["badge-color", "badgeColor"]]) {
  $("#" + id).addEventListener("input", () => {
    character[key] = key === "gradientAngle" ? Number($("#" + id).value) : $("#" + id).value;
    if (key.startsWith("gradient")) character.gradientPreset = "custom";
    syncMaterialControls(); persist(); refreshSnapshot(true);
  });
}
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
  reactionTimer = setTimeout(() => { reactionPriority = 0; setRuntimeState(audioActive() && $("#audio-reaction").checked ? "dictating" : baseState); }, reaction.duration);
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
    if (selectionDrag?.moving && selectionPreview) {
      const { source, destination } = selectionDrag;
      ctx.clearRect(source.x, source.y, source.w, source.h);
      ctx.drawImage(selectionPreview, destination.x, destination.y);
    }
    if (draft) drawStroke(ctx, draft);
    let visibleStrokes = 0;
    for (const action of actions) visibleStrokes = action.kind === "clear" ? 0 : visibleStrokes + (action.kind === "stroke" ? 1 : 0);
    $("#stroke-count").textContent = `${visibleStrokes} ${visibleStrokes === 1 ? "traço" : "traços"}`;
    $("#undo-button").disabled = !actions.length;
    $("#redo-button").disabled = !redo.length;
  });
}

function rebuild() {
  renderActions(committedCtx, actions, null, bitmapImages);
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
  else if (action.kind === "erase-region") committedCtx.clearRect(action.rect.x, action.rect.y, action.rect.w, action.rect.h);
  else if (action.kind === "bitmap") committedCtx.drawImage(bitmapImages.get(action.id), action.x, action.y, action.w, action.h);
  else if (action.kind === "move-region") moveRegion(committedCtx, action.source, action.destination);
  else drawStroke(committedCtx, action.stroke);
  scheduleDraw();
  persist();
}

function showSelection() {
  const box = $("#selection-box");
  box.hidden = !selection;
  if (!selection) return;
  Object.assign(box.style, {
    left: `${selection.x / WIDTH * 100}%`, top: `${selection.y / HEIGHT * 100}%`,
    width: `${selection.w / WIDTH * 100}%`, height: `${selection.h / HEIGHT * 100}%`,
  });
}

function rectBetween(a, b) {
  const x = Math.floor(Math.min(a.x, b.x));
  const y = Math.floor(Math.min(a.y, b.y));
  return { x, y, w: Math.min(WIDTH - x, Math.max(1, Math.ceil(Math.abs(a.x - b.x)))), h: Math.min(HEIGHT - y, Math.max(1, Math.ceil(Math.abs(a.y - b.y)))) };
}

canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0) return;
  canvas.setPointerCapture(event.pointerId);
  lastClient = { x: event.clientX, y: event.clientY };
  if (tool === "pan") { panDrag = { x: event.clientX, y: event.clientY, pan: { ...pan } }; return; }
  const point = pointFromEvent(event);
  if (tool === "select") {
    const inside = selection && point.x >= selection.x && point.x < selection.x + selection.w && point.y >= selection.y && point.y < selection.y + selection.h;
    if (inside) {
      selectionPreview = document.createElement("canvas");
      selectionPreview.width = selection.w;
      selectionPreview.height = selection.h;
      selectionPreview.getContext("2d").putImageData(committedCtx.getImageData(selection.x, selection.y, selection.w, selection.h), 0, 0);
      selectionDrag = { moving: true, start: point, source: { ...selection }, destination: { x: selection.x, y: selection.y } };
    } else { selection = null; selectionDrag = { moving: false, start: point }; }
    showSelection();
    return;
  }
  lastPoint = point;
  lastMoveAt = performance.now();
  draft = { tool, color: $("#brush-color").value, size: Number($("#brush-size").value), pressure: $("#use-pressure").checked && ["brush", "eraser"].includes(tool), points: [point] };
  recordEvent("brush.start", { x: point.x, y: point.y, tool });
  const x = botPose.x * WIDTH / 100;
  const y = botPose.y * HEIGHT / 100;
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
  if (selectionDrag) {
    const point = pointFromEvent(event);
    if (selectionDrag.moving) {
      const { source, start } = selectionDrag;
      selectionDrag.destination = {
        x: Math.round(clamp(source.x + point.x - start.x, 0, WIDTH - source.w)),
        y: Math.round(clamp(source.y + point.y - start.y, 0, HEIGHT - source.h)),
      };
      selection = { ...selectionDrag.destination, w: source.w, h: source.h };
      scheduleDraw();
    } else selection = rectBetween(selectionDrag.start, point);
    showSelection();
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
  const x = botPose.x * WIDTH / 100;
  const y = botPose.y * HEIGHT / 100;
  if (Math.hypot(point.x - x, point.y - y) < Number($("#drippy-size").value) * .55) react("near");
  else if (speed > 3) react("fast");
  scheduleDraw();
});

function finishStroke(event) {
  if (event.type === "pointercancel") {
    if (selectionDrag?.moving) selection = selectionDrag.source;
    else if (selectionDrag) selection = null;
    selectionDrag = selectionPreview = panDrag = draft = null;
    showSelection(); scheduleDraw();
    return;
  }
  if (panDrag) { panDrag = null; return; }
  if (selectionDrag) {
    if (selectionDrag.moving) {
      const { source, destination } = selectionDrag;
      if (source.x !== destination.x || source.y !== destination.y) commit({ kind: "move-region", source, destination });
    }
    selectionDrag = selectionPreview = null;
    showSelection();
    scheduleDraw();
    return;
  }
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
  selection = selectionDrag = selectionPreview = null;
  showSelection();
  canvas.classList.toggle("is-selecting", tool === "select");
  position.style.pointerEvents = tool === "select" ? "none" : "";
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

$("#undo-button").addEventListener("click", () => { if (actions.length) { redo.push(actions.pop()); selection = null; showSelection(); recordEvent("undo"); rebuild(); persist(); } });
$("#redo-button").addEventListener("click", () => { if (redo.length) { actions.push(redo.pop()); selection = null; showSelection(); recordEvent("redo"); rebuild(); persist(); } });
$("#clear-button").addEventListener("click", () => { if (actions.length && actions.at(-1)?.kind !== "clear") { recordEvent("clear"); commit({ kind: "clear" }); react("clear"); } });

function editing(event) {
  return event.target instanceof Element && Boolean(event.target.closest("input, select, textarea, [contenteditable]:not([contenteditable='false'])"));
}

function reportClipboardError(error) {
  $("#record-message").textContent = `Não foi possível colar a imagem: ${error.message}`;
}

function copyDrawing() {
  const rect = selection || { x: 0, y: 0, w: WIDTH, h: HEIGHT };
  const crop = document.createElement("canvas");
  crop.width = rect.w; crop.height = rect.h;
  crop.getContext("2d").drawImage(committed, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
  const png = crop.toDataURL("image/png");
  if (png.length > 6_000_000) {
    $("#record-message").textContent = "Seleção muito grande para copiar no projeto.";
    return false;
  }
  internalClipboard = png;
  if (navigator.clipboard?.write && window.ClipboardItem) {
    navigator.clipboard.write([new ClipboardItem({ "image/png": fetch(internalClipboard).then(response => response.blob()) })]).catch(() => {});
  }
  return true;
}

function eraseSelection() {
  if (!selection) return;
  commit({ kind: "erase-region", rect: { ...selection } });
  selection = null;
  showSelection();
}

async function pastePng(src) {
  const image = new Image();
  image.src = src;
  await image.decode();
  const scale = Math.min(1, WIDTH / image.width, HEIGHT / image.height);
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const x = Math.round(clamp(selection?.x ?? (WIDTH - w) / 2, 0, WIDTH - w));
  const y = Math.round(clamp(selection?.y ?? (HEIGHT - h) / 2, 0, HEIGHT - h));
  const resized = document.createElement("canvas");
  resized.width = w; resized.height = h;
  resized.getContext("2d").drawImage(image, 0, 0, w, h);
  const png = resized.toDataURL("image/png");
  if (png.length > 6_000_000) throw new Error("Imagem muito grande para o projeto");
  let id = [...bitmapSources].find(([, value]) => value === png)?.[0];
  const active = new Set(actions.filter(action => action.kind === "bitmap").map(action => action.id));
  const total = [...active].reduce((size, key) => size + bitmapSources.get(key).length, 0);
  if (!active.has(id) && total + png.length > 6_000_000) throw new Error("Projeto atingiu o limite de imagens; exporte antes de colar mais");
  if (!id) {
    id = crypto.randomUUID();
    bitmapSources.set(id, png);
    bitmapImages.set(id, resized);
  }
  selectTool("select");
  commit({ kind: "bitmap", id, x, y, w, h });
  selection = { x, y, w, h };
  showSelection();
}

document.addEventListener("paste", event => {
  if (editing(event)) return;
  const items = [...(event.clipboardData?.items || [])];
  const image = items.find(item => item.type.startsWith("image/"))?.getAsFile();
  if (image) {
    event.preventDefault();
    if (image.size > 12_000_000) return reportClipboardError(new Error("Imagem maior que 12 MB"));
    createImageBitmap(image).then(async bitmap => {
      const scale = Math.min(1, WIDTH / bitmap.width, HEIGHT / bitmap.height);
      const temp = document.createElement("canvas");
      temp.width = Math.max(1, Math.round(bitmap.width * scale));
      temp.height = Math.max(1, Math.round(bitmap.height * scale));
      temp.getContext("2d").drawImage(bitmap, 0, 0, temp.width, temp.height);
      bitmap.close();
      await pastePng(temp.toDataURL("image/png"));
    }).catch(reportClipboardError);
  } else if (!items.some(item => item.type.startsWith("text/")) && internalClipboard) {
    event.preventDefault();
    pastePng(internalClipboard).catch(reportClipboardError);
  }
});

const toolKeys = { p: "pen", b: "brush", e: "eraser", m: "select", l: "line", r: "rect", o: "ellipse", h: "pan" };
document.addEventListener("keydown", event => {
  if (editing(event) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (event.ctrlKey || event.metaKey) {
    const commands = {
      z: () => $(event.shiftKey ? "#redo-button" : "#undo-button").click(),
      y: () => $("#redo-button").click(),
      a: () => { selectTool("select"); selection = { x: 0, y: 0, w: WIDTH, h: HEIGHT }; showSelection(); },
      c: copyDrawing,
      x: () => { if (selection && copyDrawing()) eraseSelection(); },
      s: () => $("#export-project").click(),
      o: () => $("#import-project").click(),
    };
    if (commands[key] && !event.repeat) { event.preventDefault(); commands[key](); }
    return;
  }
  if (key === "escape" && selection) { selection = null; showSelection(); event.preventDefault(); }
  else if (["delete", "backspace"].includes(key) && selection) { event.preventDefault(); eraseSelection(); }
  else if (!event.shiftKey && toolKeys[key] && !event.repeat) { event.preventDefault(); selectTool(toolKeys[key]); }
});

$("#base-state").addEventListener("change", () => { baseState = $("#base-state").value; clearTimeout(reactionTimer); setRuntimeState(baseState); persist(); });

function applyBotLayout() {
  const size = Number($("#drippy-size").value);
  character.size = size;
  position.style.width = `${size / WIDTH * 100}%`;
  position.style.left = `${botPose.x}%`;
  position.style.top = `${botPose.y}%`;
  position.hidden = !$("#show-drippy").checked;
  position.classList.toggle("is-locked", $("#lock-drippy").checked);
  $("#drippy-size-value").textContent = `${size} px`;
}

for (const id of ["drippy-size", "drippy-x", "drippy-y"]) $("#" + id).addEventListener("input", () => {
  botPose = { x: Number($("#drippy-x").value), y: Number($("#drippy-y").value) };
  roamTarget = null; roamPausedUntil = performance.now() + 1800; applyBotLayout(); recordEvent("drippy.position", botPose); persist();
});
for (const id of ["show-drippy", "follow-brush", "react-drawing", "blink", "lock-drippy", "auto-motion", "audio-reaction", "audio-loop"]) $("#" + id).addEventListener("change", () => { applyBotLayout(); $("#audio-preview").loop = $("#audio-loop").checked; persist(); });
$("#motion-speed").addEventListener("input", persist);
$("#reset-drippy").addEventListener("click", () => { $("#drippy-x").value = "70"; $("#drippy-y").value = "58"; botPose = { x: 70, y: 58 }; roamTarget = null; applyBotLayout(); recordEvent("drippy.position", botPose); persist(); });

position.addEventListener("pointerdown", event => {
  if ($("#lock-drippy").checked) return;
  if (event.button !== 0) return;
  position.setPointerCapture(event.pointerId);
  botDrag = { x: event.clientX, y: event.clientY, bx: botPose.x, by: botPose.y, moved: false };
  position.classList.add("is-dragging");
});
position.addEventListener("pointermove", event => {
  if (!botDrag || $("#lock-drippy").checked) return;
  const rect = content.getBoundingClientRect();
  const dx = event.clientX - botDrag.x;
  const dy = event.clientY - botDrag.y;
  botDrag.moved ||= Math.hypot(dx, dy) > 4;
  botPose.x = Math.round(clamp(botDrag.bx + dx / rect.width * 100, 0, 100));
  botPose.y = Math.round(clamp(botDrag.by + dy / rect.height * 100, 0, 100));
  $("#drippy-x").value = String(botPose.x);
  $("#drippy-y").value = String(botPose.y);
  applyBotLayout();
});
function finishBotDrag() {
  if (!botDrag) return;
  if (botDrag.moved) { roamTarget = null; roamPausedUntil = performance.now() + 1800; recordEvent("drippy.position", botPose); persist(); }
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
  botPose = { x: Number($("#drippy-x").value), y: Number($("#drippy-y").value) };
  roamTarget = null;
  roamPausedUntil = performance.now() + 1800;
  applyBotLayout();
  recordEvent("drippy.position", { x: Number($("#drippy-x").value), y: Number($("#drippy-y").value) });
  persist();
});

function projectData() {
  const used = new Set(actions.filter(action => action.kind === "bitmap").map(action => action.id));
  return {
    version: 2, canvas: { width: WIDTH, height: HEIGHT }, actions, tool,
    bitmaps: Object.fromEntries([...used].map(id => [id, bitmapSources.get(id)])),
    brush: { color: $("#brush-color").value, size: Number($("#brush-size").value) },
    background: $("#background").value, zoom, baseState,
    material: Object.fromEntries(["material", "color", "eyeColor", "badgeColor", "gradientPreset", "gradientStart", "gradientEnd", "gradientAngle", "glassPreset"].map(key => [key, character[key]])),
    audio: { name: audioName, volume: Number($("#audio-volume").value), loop: $("#audio-loop").checked },
    drippy: {
      x: Number($("#drippy-x").value), y: Number($("#drippy-y").value), size: Number($("#drippy-size").value),
      visible: $("#show-drippy").checked, follow: $("#follow-brush").checked,
      reactions: $("#react-drawing").checked, blink: $("#blink").checked,
      locked: $("#lock-drippy").checked, pressure: $("#use-pressure").checked,
      autoMotion: $("#auto-motion").checked, audioReaction: $("#audio-reaction").checked,
      motionSpeed: Number($("#motion-speed").value),
    },
    timeline: { ...timeline, duration: Math.round((performance.now() - timelineOrigin) / 10) / 100 },
  };
}

async function applyProject(raw) {
  const data = parseProject(raw);
  const images = new Map();
  for (const [id, png] of Object.entries(data.bitmaps)) {
    const image = new Image();
    image.src = png;
    await image.decode();
    if (image.width > WIDTH || image.height > HEIGHT) throw new Error("Imagem colada excede o canvas");
    images.set(id, image);
  }
  bitmapSources = new Map(Object.entries(data.bitmaps));
  bitmapImages = images;
  actions = data.actions;
  redo = [];
  draft = null;
  selection = selectionDrag = selectionPreview = null;
  showSelection();
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
  botPose = { x: data.drippy.x, y: data.drippy.y }; roamTarget = null;
  for (const [id, key] of [["show-drippy", "visible"], ["follow-brush", "follow"], ["react-drawing", "reactions"], ["blink", "blink"], ["lock-drippy", "locked"], ["use-pressure", "pressure"], ["auto-motion", "autoMotion"], ["audio-reaction", "audioReaction"]]) $("#" + id).checked = data.drippy[key];
  $("#motion-speed").value = String(data.drippy.motionSpeed);
  Object.assign(character, data.material);
  syncMaterialControls();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = null; audioName = data.audio.name;
  $("#audio-preview").pause(); $("#audio-preview").removeAttribute("src"); $("#audio-preview").load();
  $("#audio-name").textContent = audioName ? `${audioName} — reanexe o arquivo para gravar` : "Nenhum áudio selecionado";
  $("#audio-volume").value = String(data.audio.volume);
  $("#audio-loop").checked = data.audio.loop;
  $("#audio-preview").loop = data.audio.loop;
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
    await applyProject(data);
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
  clone.setAttribute("style", svg.style.cssText);
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
    const x = botPose.x * WIDTH / 100 - size / 2;
    const y = botPose.y * HEIGHT / 100 - size / 2;
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
const audioPreview = $("#audio-preview");
let recordStarting = false;

function audioActive() {
  return Boolean((audioUrl && !audioPreview.paused && !audioPreview.ended) || (microphone && recorder.state === "recording"));
}

async function ensureAudioGraph() {
  if (!audioContext) {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error("Este navegador não oferece áudio Web.");
    audioContext = new Context();
    audioMix = audioContext.createGain();
    audioBus = audioContext.createMediaStreamDestination();
    audioMix.connect(audioBus);
    audioMeter = createSpeechMeter(audioContext, audioMix);
    audioGain = audioContext.createGain();
    audioSource = audioContext.createMediaElementSource(audioPreview);
    audioSource.connect(audioGain);
    audioGain.connect(audioContext.destination);
    audioGain.connect(audioMix);
  }
  await audioContext.resume();
  audioGain.gain.value = Number($("#audio-volume").value);
}

function releaseMicrophone() {
  microphoneSource?.disconnect();
  microphoneSource = null;
  microphone?.getTracks().forEach(track => track.stop());
  microphone = null;
}

audioPreview.addEventListener("play", () => ensureAudioGraph().catch(error => { audioPreview.pause(); $("#record-message").textContent = error.message; }));
$("#audio-file").addEventListener("change", event => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (recorder.state !== "inactive") { $("#record-message").textContent = "Pare a gravação antes de trocar o áudio."; return; }
  audioPreview.pause();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioUrl = URL.createObjectURL(file);
  audioName = file.name;
  audioPreview.src = audioUrl;
  audioPreview.loop = $("#audio-loop").checked;
  $("#audio-name").textContent = audioName;
  persist();
});
$("#audio-volume").addEventListener("input", () => { if (audioGain) audioGain.gain.value = Number($("#audio-volume").value); persist(); });
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
  if (recordStarting) return;
  recordStarting = true;
  $("#record-button").disabled = true;
  try {
    if (audioName && !audioUrl) throw new Error("Reanexe o áudio do projeto antes de gravar.");
    const useAudio = Boolean(audioUrl || $("#record-mic").checked);
    if (useAudio) await ensureAudioGraph();
    if ($("#record-mic").checked) {
      microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphoneSource = audioContext.createMediaStreamSource(microphone);
      microphoneSource.connect(audioMix);
    }
    if (audioUrl) { audioPreview.pause(); audioPreview.currentTime = 0; }
    await refreshSnapshot(true);
    renderComposite({ video: true });
    await recorder.start(useAudio ? audioBus.stream.getAudioTracks()[0] : null);
    audioPreview.controls = false;
    if (audioUrl) await audioPreview.play();
  } catch (error) { if (recorder.state !== "inactive") recorder.discard(); releaseMicrophone(); audioPreview.controls = true; $("#record-message").textContent = error.message; }
  finally { recordStarting = false; $("#record-button").disabled = false; }
});
$("#pause-button").addEventListener("click", async () => {
  if (recorder.state === "paused") { await audioContext?.resume(); recorder.resume(); if (audioUrl) await audioPreview.play(); }
  else { audioPreview.pause(); recorder.pause(); await audioContext?.suspend(); }
});
function finishRecording(discard = false) {
  audioPreview.pause();
  audioPreview.controls = true;
  if (discard) recorder.discard(); else recorder.stop();
  releaseMicrophone();
  engine.setSpeechLevel(0);
}
$("#stop-button").addEventListener("click", () => finishRecording());
$("#discard-button").addEventListener("click", () => finishRecording(true));

function updateRoam(now) {
  const elapsed = Math.min(50, now - roamAt) / 1000;
  roamAt = now;
  if (!$("#auto-motion").checked || $("#lock-drippy").checked || botDrag || now < roamPausedUntil || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const halfX = Number($("#drippy-size").value) / WIDTH * 50;
  const halfY = Number($("#drippy-size").value) / HEIGHT * 50;
  if (!roamTarget || Math.hypot(roamTarget.x - botPose.x, roamTarget.y - botPose.y) < 1) {
    roamTarget = { x: halfX + Math.random() * (100 - 2 * halfX), y: halfY + Math.random() * (100 - 2 * halfY) };
  }
  const dx = roamTarget.x - botPose.x, dy = roamTarget.y - botPose.y;
  const fraction = Math.min(1, elapsed * Number($("#motion-speed").value) * .45);
  botPose.x += dx * fraction;
  botPose.y += dy * fraction;
  applyBotLayout();
}

function frame() {
  const now = performance.now();
  updateRoam(now);
  engine.pointer.active = $("#follow-brush").checked && Boolean(lastClient);
  if (lastClient) { engine.pointer.clientX = lastClient.x; engine.pointer.clientY = lastClient.y; }
  const level = $("#audio-reaction").checked && audioActive() && audioMeter ? audioMeter() : 0;
  engine.setSpeechLevel(level);
  if (now >= reactionUntil && runtimeState !== (audioActive() && $("#audio-reaction").checked ? "dictating" : baseState)) setRuntimeState(audioActive() && $("#audio-reaction").checked ? "dictating" : baseState);
  if (level > .65 && now - lastAudioGesture > 4000 && now >= reactionUntil) {
    lastAudioGesture = now;
    reactionUntil = now + 650;
    setRuntimeState("excited");
  }
  if (recorder.state === "recording") { renderComposite({ video: true }); refreshSnapshot(); }
  animationFrame = requestAnimationFrame(frame);
}

try {
  const raw = localStorage.getItem(storageKey);
  if (raw) applyProject(JSON.parse(raw)).catch(() => { $("#save-status").textContent = "projeto local incompatível"; });
} catch { $("#save-status").textContent = "projeto local incompatível"; }
$("#base-state").value = baseState;
applyView();
applyBotLayout();
syncMaterialControls();
rebuild();
recordEvent("drippy.state", { state: baseState });
frame();

window.addEventListener("beforeunload", () => {
  clearTimeout(reactionTimer);
  cancelAnimationFrame(animationFrame);
  cancelAnimationFrame(drawingFrame);
  recorder.destroy();
  releaseMicrophone();
  audioPreview.pause();
  if (audioUrl) URL.revokeObjectURL(audioUrl);
  audioMeter?.disconnect();
  audioContext?.close();
  engine.destroy();
});
