import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";

const sourcePath = process.argv[2] || "/tmp/grokbot-assets.Lakwl2/15ylhd4-5eno7.js";
const stateSourcePath = process.argv[3] || "/tmp/grokbot-assets.Lakwl2/3bln_e_up5ydn.js";
const outputPath = process.argv[4] || path.resolve("original-data.js");
const source = fs.readFileSync(sourcePath, "utf8");
const pushed = [];
const context = {
  console,
  window: { Error },
  document: undefined,
  globalThis: null,
  TURBOPACK: { push: (entry) => pushed.push(entry) },
};
context.globalThis = context;
vm.runInNewContext(source, context);

const exportsById = {};
const runtime = {
  s(items, moduleId = "default") {
    const target = exportsById[moduleId] || (exportsById[moduleId] = {});
    for (let index = 0; index < items.length; index += 3) {
      target[items[index]] = items[index + 2];
    }
  },
};

const moduleFactory = pushed[0]?.at(-1);
if (typeof moduleFactory !== "function") throw new Error("Geometry module was not found");
moduleFactory(runtime);

const geometry = exportsById[283904];
const expressions = exportsById[313051]?.EXPRESSIONS;
const rawShapes = exportsById[858787]?.SHAPES;
const circleRing = exportsById[858787]?.CIRCLE_RING;
if (!geometry || !expressions || !rawShapes || !circleRing) throw new Error("Expected exports are missing");

const statePushed = [];
const stateContext = {
  console,
  window: { Error },
  document: undefined,
  globalThis: null,
  TURBOPACK: { push: (entry) => statePushed.push(entry) },
};
stateContext.globalThis = stateContext;
vm.runInNewContext(fs.readFileSync(stateSourcePath, "utf8"), stateContext);
const stateExports = {};
statePushed[0]?.[2]?.({
  s(items) {
    for (let index = 0; index < items.length; index += 3) {
      const value = items[index + 2];
      stateExports[items[index]] = value instanceof Set ? [...value] : value;
    }
  },
});
if (!stateExports.EXPRESSION_POOLS) throw new Error("State configuration was not found");

const shapes = Object.fromEntries(Object.entries(rawShapes).map(([id, shape]) => [id, {
  label: shape.label,
  path: shape.path,
  radius: shape.radius,
  beltRadius: shape.beltRadius,
  tiltScale: shape.tiltScale,
  face: shape.face,
  ring: shape.ring,
  sides: shape.sides,
  solid: shape.solid || null,
  top: shape.top,
  bottom: shape.bottom,
  spanSamples: Array.from({ length: 160 }, (_, index) => {
    const y = shape.top + ((shape.bottom - shape.top) * (index + 0.5)) / 160;
    return shape.spanAt(y);
  }),
}]));

const banner = `// Generated from the public x.ai Grok Bot geometry chunk.\n// Do not hand-edit: rerun scripts/extract-original-data.mjs.\n`;
const output = `${banner}
export const HEAD_C = ${geometry.HEAD_C};
export const EYE_HALF = ${geometry.EYE_HALF};
export const HEAD_PATH = ${JSON.stringify(geometry.HEAD)};
export const STAR_GOLD = ${JSON.stringify(geometry.STAR_GOLD)};
export const STAR_PATH = ${JSON.stringify(geometry.STAR_PATH)};
export const EXPRESSIONS = ${JSON.stringify(expressions)};
export const CIRCLE_RING = ${JSON.stringify(circleRing)};
export const SHAPES = ${JSON.stringify(shapes)};
export const ORIGINAL_STATE_DATA = ${JSON.stringify(stateExports)};
`;

fs.writeFileSync(outputPath, output);
console.log(`Wrote ${outputPath}`);
