import { DEFAULT_MATERIAL, GLASS_PRESETS, GRADIENT_PRESETS, MATERIAL_IDS } from "../component/materials.js";

export const WIDTH = 1280;
export const HEIGHT = 720;
export const DRAW_TOOLS = ["pen", "brush", "eraser", "line", "rect", "ellipse"];
export const TOOLS = [...DRAW_TOOLS, "select", "pan"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function speechLevelForAudio(energy, seconds) {
  if (!Number.isFinite(energy) || !Number.isFinite(seconds)) return 0;
  const articulation = 0.18 + 0.82 * Math.abs(Math.sin(seconds * 13.2) * Math.cos(seconds * 3.7));
  return clamp((energy - 0.015) * 1.65 * articulation, 0, 1);
}

export function drawStroke(ctx, stroke) {
  const points = stroke.points;
  if (!points?.length) return;
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = stroke.color;
  ctx.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
  const first = points[0];
  if (["pen", "brush", "eraser"].includes(stroke.tool)) {
    if (points.length === 1) {
      ctx.beginPath();
      ctx.arc(first.x, first.y, stroke.size * (stroke.tool === "brush" ? 1.7 : 1) * (stroke.pressure ? first.p : 1) / 2, 0, Math.PI * 2);
      ctx.fillStyle = stroke.tool === "eraser" ? "#000" : stroke.color;
      ctx.fill();
    } else {
      for (let i = 1; i < points.length; i++) {
        ctx.beginPath();
        ctx.lineWidth = stroke.size * (stroke.tool === "brush" ? 1.7 : 1) * (stroke.pressure ? (points[i - 1].p + points[i].p) / 2 : 1);
        ctx.moveTo(points[i - 1].x, points[i - 1].y);
        ctx.lineTo(points[i].x, points[i].y);
        ctx.stroke();
      }
    }
  } else {
    const last = points.at(-1);
    const x = Math.min(first.x, last.x);
    const y = Math.min(first.y, last.y);
    const width = Math.abs(last.x - first.x);
    const height = Math.abs(last.y - first.y);
    ctx.lineWidth = stroke.size;
    ctx.beginPath();
    if (stroke.tool === "line") { ctx.moveTo(first.x, first.y); ctx.lineTo(last.x, last.y); }
    if (stroke.tool === "rect") ctx.rect(x, y, width, height);
    if (stroke.tool === "ellipse") ctx.ellipse(x + width / 2, y + height / 2, Math.max(width / 2, .1), Math.max(height / 2, .1), 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function renderActions(ctx, actions, draft = null, bitmaps = new Map()) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  for (const action of actions) {
    if (action.kind === "clear") ctx.clearRect(0, 0, WIDTH, HEIGHT);
    else if (action.kind === "stroke") drawStroke(ctx, action.stroke);
    else if (action.kind === "move-region") moveRegion(ctx, action.source, action.destination);
    else if (action.kind === "erase-region") ctx.clearRect(action.rect.x, action.rect.y, action.rect.w, action.rect.h);
    else if (action.kind === "bitmap") {
      const image = bitmaps.get(action.id);
      if (image) ctx.drawImage(image, action.x, action.y, action.w, action.h);
    }
  }
  if (draft) drawStroke(ctx, draft);
}

export function moveRegion(ctx, source, destination) {
  const pixels = ctx.getImageData(source.x, source.y, source.w, source.h);
  ctx.clearRect(source.x, source.y, source.w, source.h);
  ctx.putImageData(pixels, destination.x, destination.y);
}

export function parseProject(data) {
  if (!data || ![1, 2].includes(data.version) || data.canvas?.width !== WIDTH || data.canvas?.height !== HEIGHT) throw new Error("Formato ou dimensões incompatíveis");
  const source = data.actions ?? (Array.isArray(data.strokes) ? data.strokes.map(stroke => ({ kind: "stroke", stroke })) : null);
  if (!Array.isArray(source) || source.length > 5000) throw new Error("Histórico inválido ou muito grande");
  const bitmapSources = data.bitmaps && typeof data.bitmaps === "object" && !Array.isArray(data.bitmaps) ? data.bitmaps : {};
  const entries = Object.entries(bitmapSources);
  if (entries.length > 100 || entries.reduce((total, [, png]) => total + String(png).length, 0) > 6_000_000 || entries.some(([id, png]) => !/^[\w-]{1,64}$/.test(id) || typeof png !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(png))) throw new Error("Imagens do projeto inválidas");
  let pointCount = 0;
  const actions = source.map(action => {
    if (action.kind === "clear") return { kind: "clear" };
    if (action.kind === "erase-region") {
      const r = action.rect;
      if (![r?.x, r?.y, r?.w, r?.h].every(Number.isInteger) || r.x < 0 || r.y < 0 || r.w < 1 || r.h < 1 || r.x + r.w > WIDTH || r.y + r.h > HEIGHT) throw new Error("Área apagada inválida");
      return { kind: "erase-region", rect: { x: r.x, y: r.y, w: r.w, h: r.h } };
    }
    if (action.kind === "bitmap") {
      if (typeof action.id !== "string" || !Object.hasOwn(bitmapSources, action.id) || ![action.x, action.y, action.w, action.h].every(Number.isInteger) || action.x < 0 || action.y < 0 || action.w < 1 || action.h < 1 || action.x + action.w > WIDTH || action.y + action.h > HEIGHT) throw new Error("Imagem colada inválida");
      return { kind: "bitmap", id: action.id, x: action.x, y: action.y, w: action.w, h: action.h };
    }
    if (action.kind === "move-region") {
      const { source: s, destination: d } = action;
      if (![s?.x, s?.y, s?.w, s?.h, d?.x, d?.y].every(Number.isInteger) || s.w < 1 || s.h < 1 || s.x < 0 || s.y < 0 || d.x < 0 || d.y < 0 || s.x + s.w > WIDTH || s.y + s.h > HEIGHT || d.x + s.w > WIDTH || d.y + s.h > HEIGHT) throw new Error("Seleção inválida");
      return { kind: "move-region", source: { x: s.x, y: s.y, w: s.w, h: s.h }, destination: { x: d.x, y: d.y } };
    }
    const stroke = action.stroke;
    if (action.kind !== "stroke" || !stroke || !DRAW_TOOLS.includes(stroke.tool) || !Array.isArray(stroke.points) || !stroke.points.length) throw new Error("Traço inválido");
    pointCount += stroke.points.length;
    if (pointCount > 150000 || !/^#[0-9a-fA-F]{6}$/.test(stroke.color)) throw new Error("Projeto inválido ou muito grande");
    return { kind: "stroke", stroke: {
      tool: stroke.tool, color: stroke.color, size: clamp(stroke.size, 1, 48), pressure: Boolean(stroke.pressure),
      points: stroke.points.map(point => {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) throw new Error("Coordenada inválida");
        return { x: clamp(point.x, 0, WIDTH), y: clamp(point.y, 0, HEIGHT), p: clamp(point.p ?? 1, .1, 1) };
      }),
    } };
  });
  const timeline = data.timeline;
  const paint = data.material || {};
  const hex = (value, fallback) => /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
  return {
    actions,
    bitmaps: Object.fromEntries(entries),
    tool: TOOLS.includes(data.tool) ? data.tool : "pen",
    brush: { color: /^#[0-9a-fA-F]{6}$/.test(data.brush?.color) ? data.brush.color : "#fec832", size: clamp(data.brush?.size || 8, 1, 48) },
    background: data.background === "transparent" ? "transparent" : hex(data.background, "white"),
    zoom: clamp(data.zoom || 1, .5, 3),
    baseState: data.baseState,
    material: {
      material: MATERIAL_IDS.includes(paint.material) ? paint.material : "solid",
      color: hex(paint.color, data.version === 1 ? "#fec832" : DEFAULT_MATERIAL.color),
      eyeColor: hex(paint.eyeColor, "#111111"), badgeColor: hex(paint.badgeColor, "#fec832"),
      gradientPreset: paint.gradientPreset === "custom" || GRADIENT_PRESETS.some(preset => preset.id === paint.gradientPreset) ? paint.gradientPreset : DEFAULT_MATERIAL.gradientPreset,
      gradientStart: hex(paint.gradientStart, DEFAULT_MATERIAL.gradientStart), gradientEnd: hex(paint.gradientEnd, DEFAULT_MATERIAL.gradientEnd),
      gradientAngle: clamp(paint.gradientAngle ?? DEFAULT_MATERIAL.gradientAngle, 0, 360),
      glassPreset: GLASS_PRESETS.some(preset => preset.id === paint.glassPreset) ? paint.glassPreset : DEFAULT_MATERIAL.glassPreset,
    },
    drippy: {
      x: clamp(data.drippy?.x ?? 70, 0, 100), y: clamp(data.drippy?.y ?? 58, 0, 100), size: clamp(data.drippy?.size || 250, 120, 420),
      visible: data.drippy?.visible !== false, hideCursor: Boolean(data.drippy?.hideCursor), follow: data.drippy?.follow !== false,
      reactions: data.drippy?.reactions !== false, blink: data.drippy?.blink !== false,
      locked: Boolean(data.drippy?.locked), pressure: Boolean(data.drippy?.pressure),
      autoMotion: data.version === 1 ? false : data.drippy?.autoMotion !== false,
      audioReaction: data.version === 1 ? false : data.drippy?.audioReaction !== false,
      motionSpeed: clamp(data.drippy?.motionSpeed ?? 1, .5, 2),
    },
    audio: { name: String(data.audio?.name || "").slice(0, 200), volume: clamp(data.audio?.volume ?? 1, 0, 1), loop: Boolean(data.audio?.loop) },
    timeline: Array.isArray(timeline?.events) ? { version: 1, duration: clamp(timeline.duration, 0, 86400), events: timeline.events.slice(0, 10000).filter(event => Number.isFinite(event.time) && typeof event.type === "string") } : { version: 1, duration: 0, events: [] },
  };
}
