import assert from "node:assert/strict";
import { test } from "node:test";
import { WIDTH, HEIGHT, parseProject, renderActions } from "./model.js";

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
