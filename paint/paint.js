import { GrokBotEngine } from "../grok-bot-engine.js";
import { ORIGINAL_STATE_DATA } from "../original-data.js";
import { MORPH_BY_STATE, STATE_CATALOG } from "../component/catalog.js";
import { DEFAULT_MATERIAL } from "../component/materials.js";

const WIDTH = 1280;
const HEIGHT = 720;
const STORAGE_KEY = "drippy-paint-studio-v1";

const canvas = document.querySelector("#draw-canvas");
const ctx = canvas.getContext("2d");
const captureCanvas = document.querySelector("#capture-canvas");
const captureCtx = captureCanvas.getContext("2d");
const stage = document.querySelector("#paint-stage");
const svg = document.querySelector("#drippy-bot");
const baseStateSelect = document.querySelector("#base-state");
const brushColor = document.querySelector("#brush-color");
const brushSize = document.querySelector("#brush-size");
const brushSizeValue = document.querySelector("#brush-size-value");
const reactionStatus = document.querySelector("#reaction-status");
const strokeCount = document.querySelector("#stroke-count");
const saveStatus = document.querySelector("#save-status");
const pointerDot = document.querySelector("#pointer-dot");

let tool = "pen";
let strokes = [];
let redoStack = [];
let currentStroke = null;
let pointerInside = false;
let lastPointer = { x: 0, y: 0 };
let lastNearReactionAt = 0;let baseState = "idle";
let runtimeState = "idle";
let reactionTimer = null;
let recorder = null;
let recordChunks = [];
let recordStartedAt = 0;
let recordTimerId = null;
let recordingStream = null;
let microphoneStream = null;
let drippySnapshot = null;
let snapshotBusy = false;
let lastSnapshotAt = 0;

const character = {
  ...DEFAULT_MATERIAL,
  eyeColor: "#111111",
  size: 250,
  flipX: false,
  pointer: true,
  halo: "soft",
  badgeColor: "#fec832",
  badgeScale: 1,
  particlesEnabled: true,
};

function configForState(id) {
  const blink = ORIGINAL_STATE_DATA.BLINK_CADENCE[id];
  return {
    ...character,
    interactive: true,
    shape: "blob",
    expressionPool: [...ORIGINAL_STATE_DATA.EXPRESSION_POOLS[id]],
    expressionWeights: {},    expressionCadence: [...ORIGINAL_STATE_DATA.EXPRESSION_CADENCE[id]],
    blinkCadence: blink ? [Math.min(...blink), Math.max(...blink)] : null,
    morph: ["thinking", "dictating"].includes(id) ? "none" : MORPH_BY_STATE[id] || "none",
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

const engine = new GrokBotEngine(svg, () => configForState(runtimeState));

function setRuntimeState(id, immediate = true) {
  runtimeState = id;
  engine.setState(id, immediate);
  reactionStatus.textContent = `Drippy: ${id}`;
}

function react(id, duration = 850) {
  if (!document.querySelector("#react-drawing").checked) return;
  clearTimeout(reactionTimer);
  setRuntimeState(id, true);
  reactionTimer = setTimeout(() => setRuntimeState(baseState, true), duration);
}

for (const state of STATE_CATALOG) {
  const option = document.createElement("option");  option.value = state.id;
  option.textContent = `${state.en || state.id} · ${state.zh || ""}`;
  baseStateSelect.append(option);
}

function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * WIDTH / rect.width,
    y: (event.clientY - rect.top) * HEIGHT / rect.height,
  };
}

function setPaintStyle(stroke) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = stroke.size;
  ctx.strokeStyle = stroke.color;
  ctx.fillStyle = stroke.color;
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
}

function drawStroke(stroke) {
  if (!stroke?.points?.length) return;
  setPaintStyle(stroke);
  const [start, ...rest] = stroke.points;

  if (stroke.tool === "pen" || stroke.tool === "eraser") {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    for (const point of rest) ctx.lineTo(point.x, point.y);
    if (!rest.length) ctx.lineTo(start.x + 0.01, start.y + 0.01);
    ctx.stroke();
    return;
  }  const end = stroke.points.at(-1);
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  ctx.beginPath();
  if (stroke.tool === "line") {
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
  } else if (stroke.tool === "rect") {
    ctx.rect(x, y, width, height);
  } else if (stroke.tool === "ellipse") {
    ctx.ellipse(x + width / 2, y + height / 2, Math.max(width / 2, .1), Math.max(height / 2, .1), 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}function redraw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  for (const stroke of strokes) drawStroke(stroke);
  if (currentStroke) drawStroke(currentStroke);
  ctx.globalCompositeOperation = "source-over";
  strokeCount.textContent = `${strokes.length} ${strokes.length === 1 ? "traço" : "traços"}`;
  document.querySelector("#undo-button").disabled = strokes.length === 0;
  document.querySelector("#redo-button").disabled = redoStack.length === 0;
}

function drippyCenterClient() {
  const rect = svg.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
    radius: rect.width * .48,
  };
}canvas.addEventListener("pointerdown", (event) => {
  const point = pointFromEvent(event);
  currentStroke = {
    tool,
    color: brushColor.value,
    size: Number(brushSize.value),
    points: [point],
  };
  redoStack = [];
  canvas.setPointerCapture(event.pointerId);
  const drippy = drippyCenterClient();
  const distance = Math.hypot(event.clientX - drippy.x, event.clientY - drippy.y);
  react(distance < drippy.radius * 1.3 ? "surprised" : "working", 700);
  redraw();
});

canvas.addEventListener("pointermove", (event) => {
  const point = pointFromEvent(event);
  lastPointer = point;
  pointerInside = true;
  const rect = canvas.getBoundingClientRect();
  pointerDot.hidden = !document.querySelector("#record-cursor").checked;
  pointerDot.style.left = `${event.clientX - rect.left}px`;
  pointerDot.style.top = `${event.clientY - rect.top}px`;
  if (!currentStroke) return;
  const drippy = drippyCenterClient();
  const distance = Math.hypot(event.clientX - drippy.x, event.clientY - drippy.y);
  if (distance < drippy.radius * 1.2 && performance.now() - lastNearReactionAt > 650) {
    lastNearReactionAt = performance.now();
    react("surprised", 650);
  }
  if (tool === "pen" || tool === "eraser") currentStroke.points.push(point);
  else currentStroke.points[1] = point;
  redraw();
});function finishStroke(event) {
  if (!currentStroke) return;
  if (currentStroke.points.length === 1) currentStroke.points.push({ ...currentStroke.points[0] });
  strokes.push(currentStroke);
  currentStroke = null;
  try { canvas.releasePointerCapture(event.pointerId); } catch {}
  react("happy", 900);
  redraw();
  persistProject();
}

canvas.addEventListener("pointerup", finishStroke);
canvas.addEventListener("pointercancel", finishStroke);
canvas.addEventListener("pointerleave", () => {
  pointerInside = false;
  pointerDot.hidden = true;
});
canvas.addEventListener("pointerenter", () => { pointerInside = true; });

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => {
    tool = button.dataset.tool;
    document.querySelectorAll(".tool").forEach((item) => item.classList.toggle("is-active", item === button));
  });
});

brushSize.addEventListener("input", () => {
  brushSizeValue.textContent = `${brushSize.value} px`;
  persistProject();
});brushColor.addEventListener("input", persistProject);

document.querySelector("#undo-button").addEventListener("click", () => {
  const stroke = strokes.pop();
  if (stroke) redoStack.push(stroke);
  redraw();
  persistProject();
});

document.querySelector("#redo-button").addEventListener("click", () => {
  const stroke = redoStack.pop();
  if (stroke) strokes.push(stroke);
  redraw();
  persistProject();
});document.querySelector("#clear-button").addEventListener("click", () => {
  if (!strokes.length) return;
  redoStack.push(...strokes.splice(0));
  redraw();
  react("surprised", 800);
  persistProject();
});

baseStateSelect.addEventListener("change", () => {
  baseState = baseStateSelect.value;
  setRuntimeState(baseState, true);
  persistProject();
});function applyDrippyLayout() {
  const size = Number(document.querySelector("#drippy-size").value);
  character.size = size;
  svg.style.left = `${document.querySelector("#drippy-x").value}%`;
  svg.style.top = `${document.querySelector("#drippy-y").value}%`;
  svg.hidden = !document.querySelector("#show-drippy").checked;
  document.querySelector("#drippy-size-value").textContent = `${size} px`;
}

["drippy-size", "drippy-x", "drippy-y"].forEach((id) => {
  document.querySelector(`#${id}`).addEventListener("input", () => {
    applyDrippyLayout();
    persistProject();
  });
});

document.querySelector("#show-drippy").addEventListener("change", () => {
  applyDrippyLayout();
  persistProject();
});function projectData() {
  return {
    version: 1,
    canvas: { width: WIDTH, height: HEIGHT },
    strokes,
    baseState,
    brush: { color: brushColor.value, size: Number(brushSize.value) },
    drippy: {
      size: Number(document.querySelector("#drippy-size").value),
      x: Number(document.querySelector("#drippy-x").value),
      y: Number(document.querySelector("#drippy-y").value),
      visible: document.querySelector("#show-drippy").checked,
      reactions: document.querySelector("#react-drawing").checked,
      recordCursor: document.querySelector("#record-cursor").checked,
    },
  };
}

function persistProject() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projectData()));
    saveStatus.textContent = "salvo";
  } catch {
    saveStatus.textContent = "não salvo";
  }
}function applyProject(data) {
  if (!data || data.version !== 1) throw new Error("Projeto incompatível");
  strokes = Array.isArray(data.strokes) ? data.strokes : [];
  redoStack = [];
  baseState = STATE_CATALOG.some((state) => state.id === data.baseState) ? data.baseState : "idle";
  baseStateSelect.value = baseState;
  brushColor.value = data.brush?.color || "#fec832";
  brushSize.value = String(data.brush?.size || 8);
  brushSizeValue.textContent = `${brushSize.value} px`;

  const drippy = data.drippy || {};
  document.querySelector("#drippy-size").value = String(drippy.size || 250);
  document.querySelector("#drippy-x").value = String(drippy.x ?? 70);
  document.querySelector("#drippy-y").value = String(drippy.y ?? 58);
  document.querySelector("#show-drippy").checked = drippy.visible !== false;
  document.querySelector("#react-drawing").checked = drippy.reactions !== false;
  document.querySelector("#record-cursor").checked = drippy.recordCursor !== false;

  applyDrippyLayout();
  setRuntimeState(baseState, true);
  redraw();
}

function loadStoredProject() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try { applyProject(JSON.parse(raw)); } catch { localStorage.removeItem(STORAGE_KEY); }
}function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

document.querySelector("#export-project").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(projectData(), null, 2)], { type: "application/json" });
  downloadBlob(blob, `drippy-paint-${Date.now()}.json`);
});

document.querySelector("#import-project").addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    applyProject(JSON.parse(await file.text()));
    persistProject();
    react("happy", 900);
  } catch (error) {
    alert(`Não foi possível importar: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});const embeddedSvgCss = `
  .grok-bot-mark__head,.morph-part{fill:var(--fg,#f3f3f3)}
  .grok-bot-mark__eye,.drippy-eye,.drippy-mouth-open{fill:var(--bg,#111)}
  .eye-path{display:none}
  .drippy-ear{fill:none;stroke:var(--bg,#111);stroke-width:3.6;stroke-linecap:round;stroke-linejoin:round}
  .drippy-mouth{fill:none;stroke:var(--bg,#111);stroke-width:4;stroke-linecap:round}
  .morph-ring{fill:none;stroke:var(--fg,#f3f3f3)}
  .morph-glyph{fill:var(--fg,#f3f3f3)}
  [hidden]{display:none}
`;

function refreshDrippySnapshot() {
  if (snapshotBusy || svg.hidden) return;
  snapshotBusy = true;
  const clone = svg.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", "259");
  clone.setAttribute("height", "259");
  clone.style.cssText = svg.style.cssText;
  const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = embeddedSvgCss;
  clone.querySelector("defs")?.append(style);
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  const image = new Image();  image.onload = () => {
    drippySnapshot = image;
    snapshotBusy = false;
    URL.revokeObjectURL(url);
  };
  image.onerror = () => {
    snapshotBusy = false;
    URL.revokeObjectURL(url);
  };
  image.src = url;
}

function renderComposite(now = performance.now()) {
  captureCtx.globalCompositeOperation = "source-over";
  captureCtx.fillStyle = "#111111";
  captureCtx.fillRect(0, 0, WIDTH, HEIGHT);
  captureCtx.drawImage(canvas, 0, 0, WIDTH, HEIGHT);

  if (!svg.hidden && drippySnapshot?.complete) {
    const stageRect = stage.getBoundingClientRect();
    const botRect = svg.getBoundingClientRect();
    const x = (botRect.left - stageRect.left) * WIDTH / stageRect.width;
    const y = (botRect.top - stageRect.top) * HEIGHT / stageRect.height;
    const width = botRect.width * WIDTH / stageRect.width;
    const height = botRect.height * HEIGHT / stageRect.height;
    captureCtx.drawImage(drippySnapshot, x, y, width, height);
  }

  if (pointerInside && document.querySelector("#record-cursor").checked) {
    const radius = Math.max(7, Number(brushSize.value) / 2 + 3);    captureCtx.beginPath();
    captureCtx.arc(lastPointer.x, lastPointer.y, radius, 0, Math.PI * 2);
    captureCtx.strokeStyle = "#fec832";
    captureCtx.lineWidth = 3;
    captureCtx.stroke();
  }

  if (now - lastSnapshotAt > 40) {
    lastSnapshotAt = now;
    refreshDrippySnapshot();
  }
}

function compositeLoop(now) {
  renderComposite(now);
  requestAnimationFrame(compositeLoop);
}
requestAnimationFrame(compositeLoop);

document.querySelector("#export-png").addEventListener("click", () => {
  renderComposite(performance.now());
  captureCanvas.toBlob((blob) => {
    if (blob) downloadBlob(blob, `drippy-paint-${Date.now()}.png`);
  }, "image/png");
});

function bestRecordingMime() {
  const types = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}function formatDuration(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

async function startRecording() {
  if (!window.MediaRecorder || !captureCanvas.captureStream) {
    alert("Este navegador não suporta gravação do canvas.");
    return;
  }

  renderComposite(performance.now());
  recordingStream = captureCanvas.captureStream(30);

  if (document.querySelector("#record-mic").checked) {
    try {
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of microphoneStream.getAudioTracks()) recordingStream.addTrack(track);
    } catch {
      document.querySelector("#record-mic").checked = false;
    }
  }

  const mimeType = bestRecordingMime();
  recorder = new MediaRecorder(recordingStream, mimeType ? { mimeType } : undefined);
  recordChunks = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size) recordChunks.push(event.data);
  });  recorder.addEventListener("stop", () => {
    const type = recorder.mimeType || mimeType || "video/webm";
    const blob = new Blob(recordChunks, { type });
    const url = URL.createObjectURL(blob);
    const preview = document.querySelector("#recording-preview");
    const download = document.querySelector("#download-recording");
    if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    preview.dataset.objectUrl = url;
    preview.src = url;
    preview.hidden = false;
    download.href = url;
    download.download = `drippy-paint-${Date.now()}.${type.includes("mp4") ? "mp4" : "webm"}`;
    download.hidden = false;
  });

  recorder.start(250);
  recordStartedAt = performance.now();
  document.querySelector("#record-button").classList.add("is-recording");
  document.querySelector("#record-button").lastChild.textContent = " Parar";
  recordTimerId = setInterval(() => {
    document.querySelector("#record-timer").textContent = formatDuration(performance.now() - recordStartedAt);
  }, 250);
  react("excited", 650);
}

function stopRecording() {
  if (!recorder || recorder.state === "inactive") return;
  recorder.stop();
  clearInterval(recordTimerId);
  document.querySelector("#record-button").classList.remove("is-recording");
  document.querySelector("#record-button").lastChild.textContent = " Gravar";
  recordingStream?.getTracks().forEach((track) => track.stop());
  microphoneStream?.getTracks().forEach((track) => track.stop());
  microphoneStream = null;
  react("happy", 900);
}document.querySelector("#record-button").addEventListener("click", async () => {
  if (recorder?.state === "recording") stopRecording();
  else await startRecording();
});

["react-drawing", "record-cursor"].forEach((id) => {
  document.querySelector(`#${id}`).addEventListener("change", () => {
    if (id === "record-cursor" && !document.querySelector("#record-cursor").checked) pointerDot.hidden = true;
    persistProject();
  });
});

baseStateSelect.value = baseState;
loadStoredProject();
applyDrippyLayout();
setRuntimeState(baseState, true);
redraw();

window.addEventListener("beforeunload", () => {
  if (recorder?.state === "recording") recorder.stop();
  engine.destroy();
});