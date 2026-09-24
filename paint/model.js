export const WIDTH = 1280;
export const HEIGHT = 720;
export const TOOLS = ["pen", "brush", "eraser", "line", "rect", "ellipse", "pan"];

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

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

export function renderActions(ctx, actions, draft = null) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  for (const action of actions) {
    if (action.kind === "clear") ctx.clearRect(0, 0, WIDTH, HEIGHT);
    else if (action.kind === "stroke") drawStroke(ctx, action.stroke);
  }
  if (draft) drawStroke(ctx, draft);
}

export function parseProject(data) {
  if (!data || data.version !== 1 || data.canvas?.width !== WIDTH || data.canvas?.height !== HEIGHT) throw new Error("Formato ou dimensões incompatíveis");
  const source = data.actions ?? (Array.isArray(data.strokes) ? data.strokes.map(stroke => ({ kind: "stroke", stroke })) : null);
  if (!Array.isArray(source) || source.length > 5000) throw new Error("Histórico inválido ou muito grande");
  let pointCount = 0;
  const actions = source.map(action => {
    if (action.kind === "clear") return { kind: "clear" };
    const stroke = action.stroke;
    if (action.kind !== "stroke" || !stroke || !TOOLS.slice(0, -1).includes(stroke.tool) || !Array.isArray(stroke.points) || !stroke.points.length) throw new Error("Traço inválido");
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
  return {
    actions,
    tool: TOOLS.includes(data.tool) ? data.tool : "pen",
    brush: { color: /^#[0-9a-fA-F]{6}$/.test(data.brush?.color) ? data.brush.color : "#fec832", size: clamp(data.brush?.size || 8, 1, 48) },
    background: data.background === "transparent" ? "transparent" : "white",
    zoom: clamp(data.zoom || 1, .5, 3),
    baseState: data.baseState,
    drippy: {
      x: clamp(data.drippy?.x ?? 70, 0, 100), y: clamp(data.drippy?.y ?? 58, 0, 100), size: clamp(data.drippy?.size || 250, 120, 420),
      visible: data.drippy?.visible !== false, follow: data.drippy?.follow !== false,
      reactions: data.drippy?.reactions !== false, blink: data.drippy?.blink !== false,
      locked: Boolean(data.drippy?.locked), pressure: Boolean(data.drippy?.pressure),
    },
    timeline: Array.isArray(timeline?.events) ? { version: 1, duration: clamp(timeline.duration, 0, 86400), events: timeline.events.slice(0, 10000).filter(event => Number.isFinite(event.time) && typeof event.type === "string") } : { version: 1, duration: 0, events: [] },
  };
}
