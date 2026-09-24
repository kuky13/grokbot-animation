import assert from "node:assert/strict";
import { test } from "node:test";
import { WIDTH, HEIGHT, moveRegion, parseProject, renderActions } from "./model.js";

const stroke = { tool: "pen", color: "#fec832", size: 8, points: [{ x: 4, y: 5, p: 1 }, { x: 10, y: 12, p: 1 }] };
const project = { version: 1, canvas: { width: WIDTH, height: HEIGHT }, actions: [{ kind: "stroke", stroke }, { kind: "clear" }], timeline: { version: 1, duration: 1, events: [{ time: .1, type: "brush.start" }] } };

test("project preserves vector actions and timeline", () => {
  const parsed = parseProject(project);
  assert.equal(parsed.actions.length, 2);
  assert.equal(parsed.actions[0].stroke.points[1].x, 10);
  assert.equal(parsed.timeline.events[0].type, "brush.start");
});

test("legacy stroke projects remain importable", () => {
  const parsed = parseProject({ version: 1, canvas: project.canvas, strokes: [stroke] });
  assert.equal(parsed.actions[0].kind, "stroke");
});

test("malformed and oversized projects are rejected", () => {
  assert.throws(() => parseProject({ ...project, canvas: { width: 999, height: HEIGHT } }));
  assert.throws(() => parseProject({ ...project, actions: [{ kind: "stroke", stroke: { ...stroke, points: [{ x: Infinity, y: 0 }] } }] }));
  assert.throws(() => parseProject({ ...project, actions: Array(5001).fill({ kind: "clear" }) }));
});

test("clear is an undoable command, not a destructive reset", () => {
  const calls = [];
  const ctx = new Proxy({}, { get: (_, name) => (...args) => calls.push([name, ...args]), set: () => true });
  renderActions(ctx, parseProject(project).actions);
  assert.ok(calls.filter(([name]) => name === "clearRect").length >= 2);
});

test("v2 selection movement and material survive import; v1 defaults remain", () => {
  const moved = { kind: "move-region", source: { x: 4, y: 5, w: 6, h: 7 }, destination: { x: 20, y: 30 } };
  const parsed = parseProject({ ...project, version: 2, actions: [{ kind: "stroke", stroke }, moved], material: { material: "gradient", gradientPreset: "custom", gradientStart: "#112233", gradientEnd: "#445566", gradientAngle: 45 }, audio: { name: "music.ogg", volume: .4 } });
  assert.deepEqual(parsed.actions[1], moved);
  assert.equal(parsed.material.gradientStart, "#112233");
  assert.equal(parsed.audio.name, "music.ogg");
  assert.equal(parseProject(project).drippy.autoMotion, false);
  assert.throws(() => parseProject({ ...project, version: 2, actions: [{ ...moved, destination: { x: WIDTH, y: 0 } }] }));
  const calls = [];
  const ctx = { getImageData: () => "pixels", clearRect: (...args) => calls.push(["clear", ...args]), putImageData: (...args) => calls.push(["put", ...args]) };
  moveRegion(ctx, moved.source, moved.destination);
  assert.deepEqual(calls, [["clear", 4, 5, 6, 7], ["put", "pixels", 20, 30]]);
});

test("pasted pixels and deletion replay after project import", () => {
  const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/f4cAAAAASUVORK5CYII=";
  const pasted = { kind: "bitmap", id: "image-1", x: 10, y: 20, w: 1, h: 1 };
  const erased = { kind: "erase-region", rect: { x: 10, y: 20, w: 1, h: 1 } };
  const parsed = parseProject({ ...project, version: 2, actions: [pasted, erased], bitmaps: { "image-1": png } });
  const calls = [];
  const ctx = { clearRect: (...args) => calls.push(["clear", ...args]), drawImage: (...args) => calls.push(["draw", ...args]) };
  renderActions(ctx, parsed.actions, null, new Map([["image-1", "decoded image"]]));
  assert.deepEqual(calls.at(-2), ["draw", "decoded image", 10, 20, 1, 1]);
  assert.deepEqual(calls.at(-1), ["clear", 10, 20, 1, 1]);
  assert.throws(() => parseProject({ ...project, version: 2, actions: [pasted], bitmaps: {} }));
  assert.throws(() => parseProject({ ...project, version: 2, actions: [erased], bitmaps: { bad: "data:image/svg+xml;base64,AAA" } }));
});
