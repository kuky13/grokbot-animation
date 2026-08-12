import assert from "node:assert/strict";

globalThis.window = {
  matchMedia: () => ({ matches: false }),
};

const { GrokBotEngine, MORPH_SIZES } = await import("../grok-bot-engine.js");
const effects = Object.keys(MORPH_SIZES);

function transitionHarness(effect = null) {
  return Object.assign(Object.create(GrokBotEngine.prototype), {
    state: effect === "progress" ? "progress" : effect === "gather" ? "spawning" : "idle",
    requestedMorphEffect: effect,
    morphEffect: effect,
    previousMorphEffect: null,
    morph: { x: effect ? 1 : 0, v: 0, target: effect ? 1 : 0 },
    morphBlend: { x: 1, v: 0, target: 1 },
    morphVisible: Boolean(effect),
    morphStartedAt: 0,
    morphShotStartedAt: 0,
    morphRestStartedAt: 0,
    oneShotResting: false,
    turn: { x: 0, v: 0, target: 0 },
    turnDirection: 1,
  });
}

for (const from of effects) {
  const exiting = transitionHarness(from);
  exiting.updateMorph(100, { morph: "none" });
  assert.equal(exiting.morphEffect, from, `${from} should remain active while exiting`);
  assert.equal(exiting.previousMorphEffect, null);
  assert.equal(exiting.morph.target, 0);

  exiting.morph.x = 0.003;
  exiting.updateMorph(200, { morph: "none" });
  assert.equal(exiting.morphEffect, null, `${from} should clear after its exit spring settles`);

  for (const to of effects) {
    if (to === from) continue;
    const switching = transitionHarness(from);
    switching.updateMorph(100, { morph: to });
    assert.equal(switching.morphEffect, to, `${from} -> ${to} should activate the target effect`);
    assert.equal(switching.previousMorphEffect, from, `${from} -> ${to} should retain the outgoing effect`);
    assert.equal(switching.morphBlend.x, 0, `${from} -> ${to} should begin a crossfade`);
    assert.equal(switching.morphBlend.target, 1);
    assert.equal(switching.morph.target, 1);

    switching.morphBlend.x = 0.997;
    switching.updateMorph(200, { morph: to });
    assert.equal(switching.previousMorphEffect, null, `${from} -> ${to} should release the outgoing effect after blending`);
  }
}

for (const to of effects) {
  const entering = transitionHarness();
  entering.updateMorph(100, { morph: to });
  assert.equal(entering.morphEffect, to);
  assert.equal(entering.previousMorphEffect, null);
  assert.equal(entering.morphBlend.x, 1);
  assert.equal(entering.morph.target, 1);
}

console.log(`Morph transitions verified: ${effects.length} exits, ${effects.length * (effects.length - 1)} direct switches, ${effects.length} entries.`);
