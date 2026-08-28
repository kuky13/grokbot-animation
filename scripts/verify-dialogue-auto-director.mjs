import assert from "node:assert/strict";
import { MORPH_IDS, STATE_IDS } from "../component/catalog.js";
import {
  classifyMood,
  planDialogueActions,
  splitIntoClauses,
} from "../component/dialogue-auto-director.js";

const mixedText = "你好！让我想一下……为什么这个方案会更好？太棒了，我们完成了！";
const firstTake = planDialogueActions(mixedText, { seed: "take-one" });
const repeatedTake = planDialogueActions(mixedText, { seed: "take-one" });
const secondTake = planDialogueActions(mixedText, { seed: "take-two" });

assert.deepEqual(firstTake, repeatedTake, "a seeded automatic take should be reproducible");
assert.notEqual(firstTake.signature, secondTake.signature, "a new seed should produce a visibly different take");
assert.equal(
  firstTake.script.filter(({ type }) => type === "text").map(({ text }) => text).join(""),
  mixedText,
  "automatic action insertion must preserve the source text exactly",
);
assert.ok(firstTake.actionCount >= 3, "a multi-sentence dialogue should receive several actions");
assert.ok(firstTake.actionCount <= 14, "automatic direction should stay below the visual-density ceiling");
assert.ok(firstTake.script.some(({ type }) => type === "pause"), "an ellipsis between clauses should create a deliberate pause");

for (const node of firstTake.script) {
  if (node.type === "state") assert.ok(STATE_IDS.includes(node.state), `unknown generated state: ${node.state}`);
  if (node.type === "morph") assert.ok(MORPH_IDS.includes(node.effect), `unknown generated Morph: ${node.effect}`);
  if (node.type !== "text") assert.ok(Number.isFinite(node.duration) && node.duration >= 0, "every generated action needs a valid duration");
}

const question = planDialogueActions("为什么会这样？", { seed: "question" });
assert.ok(
  question.script.some(({ type, state }) => type === "state" && ["curious", "thinking", "confused"].includes(state)),
  "questions should begin with a question-aware expression",
);
const celebration = planDialogueActions("太棒了，我们成功了！", { seed: "celebration" });
assert.ok(
  celebration.script.some(({ type, state }) => type === "state" && ["celebrate", "excited", "proud"].includes(state)),
  "celebratory language should begin with a celebratory expression",
);

assert.equal(classifyMood("How can this work?"), "question");
assert.equal(classifyMood("总之，这就是结论。"), "conclusion");
assert.equal(splitIntoClauses("一，二……三！").join(""), "一，二……三！", "clause splitting must be lossless");
assert.throws(() => planDialogueActions("   "), TypeError, "empty dialogue should not generate actions");

console.log(`Dialogue auto director verified: ${firstTake.clauseCount} clauses, ${firstTake.actionCount} constrained random actions, lossless text.`);
