import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  compileDialogue,
  DIALOGUE_VOICES,
  DialogueDirector,
} from "../component/runtime/dialogue-director.js";
import {
  AnimaleseEngine,
  MemorySampler,
} from "../component/runtime/vendor/animalese-tts/animalese.browser.mjs";
import {
  ChineseTextAnalyzer,
  MandarinPitchManager,
  ScheduledWebPlayer,
} from "../component/runtime/chinese-animalese.js";
import { renderDialogueAudioTimeline } from "../component/runtime/dialogue-audio-timeline.js";
import { analyzeSpeechUnits } from "../component/runtime/speech-unit-analyzer.js";

assert.deepEqual(DIALOGUE_VOICES.map(({ id }) => id), ["playful", "animalese", "gameboy", "rpg"], "dialogue should expose the playful voice first and retain the local retro voices");

const compiled = compileDialogue([
  { id: "hello", type: "state", state: "idle", duration: 300 },
  { type: "text", text: "你好，Morph Bot!" },
  { id: "turn", type: "rotate", angle: -12, duration: 260 },
  { id: "wave", type: "morph", effect: "wave", duration: 650 },
  { type: "pause", duration: 500 },
]);

assert.equal(compiled.nodes.length, 5);
assert.equal(compiled.voice, "playful");
assert.equal(compiled.englishMode, "phonetic");
assert.equal(compileDialogue([{ type: "text", text: "Hello" }], { englishMode: "letters" }).englishMode, "letters");
assert.equal(compiled.nodes[0].id, "hello", "dialogue action ids should survive compilation for editor highlighting");
assert.equal(compiled.nodes[2].angle, -12);
assert.ok(compiled.duration > 2500, "compiled duration should include speech, actions and Morph transition time");
assert.ok(Object.isFrozen(compiled.nodes), "compiled dialogue nodes should be immutable at the collection level");

const faster = compileDialogue([{ type: "text", text: "你好，Morph Bot!" }], { rate: 2 });
const normal = compileDialogue([{ type: "text", text: "你好，Morph Bot!" }]);
assert.ok(faster.duration < normal.duration, "dialogue rate should affect the speech clock");
const animaleseTiming = compileDialogue([{ type: "text", text: "你好，Morph Bot!" }], { voice: "animalese" });
assert.ok(normal.duration < animaleseTiming.duration, "playful gibberish should keep a quicker cadence than animalese");

const mandarin = analyzeSpeechUnits("重庆银行");
assert.deepEqual(mandarin.map(({ phonetic }) => phonetic), ["chong", "qing", "yin", "hang"], "Mandarin analysis should use phrase context for polyphonic characters");
assert.deepEqual(mandarin.map(({ tone }) => tone), [2, 4, 2, 2], "Mandarin analysis should retain lexical tones");
assert.equal(analyzeSpeechUnits("Morph")[0].isCjk, false, "Latin dialogue should remain supported alongside Mandarin");

const animaleseAnalyzer = new ChineseTextAnalyzer();
assert.deepEqual(
  animaleseAnalyzer.analyze("重庆").map((tokens) => tokens.map(({ phoneme }) => phoneme).join("")),
  ["chong", "qing"],
  "Chinese Animalese should map every Han character to one phrase-aware pinyin phoneme group",
);
const mixedText = "你好 Morph thing 2！";
const phoneticGroups = animaleseAnalyzer.analyze(mixedText).map((tokens) => tokens.map(({ phoneme }) => phoneme).join(""));
assert.deepEqual(
  phoneticGroups,
  ["ni", "hao", " ", "mo", "", "r", "ph", "", " ", "thi", "", "", "ng", "", " ", "two", "！"],
  "automatic language routing should keep Mandarin syllables, use upstream English groups, and speak digits",
);
const letterAnalyzer = new ChineseTextAnalyzer({ englishMode: "letters" });
assert.deepEqual(
  letterAnalyzer.analyze("中Morph").map((tokens) => tokens.map(({ phoneme }) => phoneme).join("")),
  ["zhong", "m", "o", "r", "p", "h"],
  "letter mode should retain Mandarin syllables while spelling English one character at a time",
);
const spriteBuffer = await readFile(new URL("../component/runtime/vendor/animalese-tts/english-sprite.wav", import.meta.url));
const spriteMap = JSON.parse(await readFile(new URL("../component/runtime/vendor/animalese-tts/english-sprite.json", import.meta.url), "utf8"));
const sampledEffect = new MandarinPitchManager({
  pitch: 1.62,
  speed: 4.35,
  randomness: 0,
  melodyRate: 0,
  melodyAmplitude: 0,
});
const sampledSampler = new MemorySampler(spriteBuffer, spriteMap);
const sampledEngine = new AnimaleseEngine({
  analyzer: animaleseAnalyzer,
  sampler: sampledSampler,
  effect: sampledEffect,
  punctuationDelay: 0.24,
  punctuations: ["，", "！"],
});
await sampledEngine.load();
sampledEffect.prepare("重庆，你好！", 1, animaleseAnalyzer.analyze("重庆，你好！"));
const sampledOutputs = [];
for await (const output of sampledEngine.synthesize("重庆，你好！").speak()) sampledOutputs.push(output);
assert.deepEqual(sampledOutputs.map(({ char }) => char), ["重", "庆", "，", "你", "好", "！"], "Animalese output should retain Chinese punctuation and character order");
assert.deepEqual(sampledOutputs.slice(0, 2).map(({ phoneme }) => phoneme), ["chong", "qing"], "AnimaleseEngine should synthesize Mandarin pinyin groups");
assert.ok(sampledOutputs.every(({ buffer }) => buffer.length > 0), "sampled dialogue should contain real decoded Sprite audio, including punctuation pauses");
assert.equal(sampledSampler.sampleRate, 48000, "the vendored voice Sprite should decode at its authored sample rate");

const mixedEffect = new MandarinPitchManager({ pitch: 1.62, speed: 4.35, randomness: 0, melodyRate: 0, melodyAmplitude: 0 });
const mixedEngine = new AnimaleseEngine({
  analyzer: animaleseAnalyzer,
  sampler: sampledSampler,
  effect: mixedEffect,
  punctuationDelay: 0.24,
  punctuations: ["！"],
});
const mixedGroups = animaleseAnalyzer.analyze(mixedText);
mixedEffect.prepare(mixedText, 1, mixedGroups);
const mixedOutputs = [];
for await (const output of mixedEngine.synthesize(mixedText).speak()) mixedOutputs.push(output);
assert.deepEqual(
  mixedOutputs.map(({ char, phoneme }) => [char, phoneme]),
  [["你", "ni"], ["好", "hao"], [" ", " "], ["Mo", "mo"], ["r", "r"], ["ph", "ph"], [" ", " "], ["thi", "thi"], ["ng", "ng"], [" ", " "], ["2", "two"], ["！", "！"]],
  "mixed synthesis should preserve visible text while routing English through grouped phonemes",
);
const mixedTimeline = renderDialogueAudioTimeline(mixedOutputs, { sampleRate: sampledSampler.sampleRate, crossfadeMs: 10 });
const unjoinedSamples = mixedOutputs.reduce((total, { buffer }) => total + buffer.length, 0);
assert.ok(mixedTimeline.buffer.length < unjoinedSamples, "voiced neighbors should overlap instead of leaving a per-character gap");
assert.equal(mixedTimeline.cues.length, mixedOutputs.length, "the phrase buffer should retain one visual cue per synthesized output");
assert.equal(mixedTimeline.cues[2].voiced, false, "spaces should stay silent and reset crossfades");
assert.ok(mixedTimeline.cues[1].start < mixedTimeline.cues[0].end, "adjacent Mandarin syllables should use an audible crossfade");
assert.deepEqual(
  mixedTimeline.visualCues.map(({ char }) => char),
  Array.from(mixedText),
  "grouped English phonemes should still reveal one visible character per cue",
);

assert.throws(() => compileDialogue([]), TypeError);
assert.throws(() => compileDialogue([{ type: "state", state: "missing" }, { type: "text", text: "x" }]), RangeError);
assert.throws(() => compileDialogue([{ type: "morph", effect: "missing" }, { type: "text", text: "x" }]), RangeError);
assert.throws(() => compileDialogue([{ type: "rotate", angle: Number.NaN }, { type: "text", text: "x" }]), RangeError);
assert.throws(() => compileDialogue([{ type: "pause", duration: 400 }]), TypeError, "actions without visible text should not compile");

class FakeAudioParam {
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}

class FakeAudioNode {
  constructor(kind) {
    this.kind = kind;
    this.frequency = new FakeAudioParam();
    this.Q = new FakeAudioParam();
    this.gain = new FakeAudioParam();
    this.playbackRate = { value: 1 };
    this.listeners = new Map();
  }
  connect(destination) { return destination; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  start(time) { this.startedAt = time; }
  stop() { this.listeners.get("ended")?.(); }
}

class FakeAudioContext {
  constructor() {
    this.currentTime = 1;
    this.sampleRate = 48000;
    this.state = "running";
    this.baseLatency = 0.01;
    this.outputLatency = 0.02;
    this.destination = new FakeAudioNode("destination");
    this.created = [];
  }
  _create(kind) {
    const node = new FakeAudioNode(kind);
    this.created.push(node);
    return node;
  }
  createOscillator() { return this._create("oscillator"); }
  createGain() { return this._create("gain"); }
  createBufferSource() { return this._create("buffer-source"); }
  createBuffer(_channels, length) {
    const storage = new Float32Array(length);
    return { copyToChannel: (buffer) => storage.set(buffer) };
  }
  getOutputTimestamp() { return { contextTime: 0, performanceTime: 0 }; }
  async resume() { this.state = "running"; }
  async suspend() { this.state = "suspended"; }
}

globalThis.AudioContext = FakeAudioContext;
globalThis.window = globalThis;
const scheduledPlayer = new ScheduledWebPlayer(48000);
const scheduledPlayback = scheduledPlayer.playScheduled(new Float32Array(4800), { leadIn: 0.06 });
assert.equal(scheduledPlayback.source.startedAt, scheduledPlayback.startTime, "sampled phrases should be scheduled against AudioContext time");
assert.ok(scheduledPlayback.position() < 0, "the audio master clock should stay negative during its scheduling lead-in");
scheduledPlayback.context.currentTime = scheduledPlayback.startTime + scheduledPlayback.context.baseLatency + scheduledPlayback.context.outputLatency + 0.025;
assert.ok(Math.abs(scheduledPlayback.position() - 25) < 0.001, "fallback clock should compensate the device output latency");
scheduledPlayback.context.state = "suspended";
const suspendedPosition = scheduledPlayback.position();
scheduledPlayback.context.currentTime += 1;
assert.equal(scheduledPlayback.position(), suspendedPosition, "the audio master clock should freeze while its context is suspended");
scheduledPlayer.stopAll();

const audioBot = { paused: false, dispatchEvent: () => true, pause() {}, play() {} };
const audioDirector = new DialogueDirector(audioBot);
await audioDirector.voice.resume("gameboy");
audioDirector.voice.chirp(analyzeSpeechUnits("怕")[0], "gameboy", 1);
const createdAudioKinds = audioDirector.voice.context.created.map(({ kind }) => kind);
assert.equal(createdAudioKinds.filter((kind) => kind === "oscillator").length, 1, "Game Boy voice should retain its local square-wave fallback");
audioDirector.voice.stop();

globalThis.CustomEvent = class CustomEvent {
  constructor(type, options = {}) { this.type = type; this.detail = options.detail; }
};
let frameTime = performance.now();
globalThis.requestAnimationFrame = (callback) => {
  frameTime += 20;
  queueMicrotask(() => callback(frameTime));
  return frameTime;
};
const phraseEvents = [];
const playedPhrases = [];
let fakeAudioPosition = -20;
const phraseBot = {
  paused: false,
  dispatchEvent(event) { phraseEvents.push(event); return true; },
  pause() { this.paused = true; },
  play() { this.paused = false; },
};
const phraseDirector = new DialogueDirector(phraseBot);
phraseDirector.voice = {
  stop() {},
  suspend() {},
  async resume() {},
  async speech(text, voice, rate, options) {
    assert.equal(text, "中English");
    assert.equal(voice, "animalese");
    assert.equal(rate, 1);
    assert.equal(options.englishMode, "letters");
    return {
      buffer: new Float32Array(1920),
      duration: 40,
      sampleRate: 48000,
      cues: [
        { char: "中", phoneme: "zhong", pitch: 1.5, start: 0, duration: 25, end: 25 },
        { char: "English", phoneme: "english", pitch: 1.5, start: 20, duration: 20, end: 40 },
      ],
    };
  },
  playSample(buffer, voice) {
    playedPhrases.push({ buffer, voice });
    return {
      ended: false,
      position() {
        fakeAudioPosition += 20;
        if (fakeAudioPosition >= 40) this.ended = true;
        return fakeAudioPosition;
      },
    };
  },
};
const phraseResult = await phraseDirector.play([{ type: "text", text: "中English" }], {
  voice: "animalese",
  englishMode: "letters",
  rate: 1,
});
assert.equal(phraseResult.cancelled, false);
assert.equal(playedPhrases.length, 1, "a sampled text node should play as one phrase buffer");
assert.deepEqual(
  phraseEvents.filter(({ type }) => type === "dialoguecharacter").map(({ detail }) => [detail.character, detail.audioTime]),
  [["中", 0], ["English", 20]],
  "visual text should advance from sample-accurate phrase cues",
);
assert.equal(phraseEvents.find(({ type }) => type === "dialoguestart").detail.duration, 40, "runtime progress should use the rendered phrase duration");
assert.equal(phraseEvents.find(({ type }) => type === "dialoguestart").detail.englishMode, "letters");

const transportCalls = [];
const fakeBot = {
  paused: true,
  dispatchEvent: () => true,
  pause() { this.paused = true; transportCalls.push("pause"); },
  play() { this.paused = false; transportCalls.push("play"); },
};
const director = new DialogueDirector(fakeBot);
director.playing = true;
director.paused = true;
director.initialPaused = false;
director.stop({ restorePause: true });
assert.equal(fakeBot.paused, false, "stopping a paused dialogue should restore an originally playing bot");
assert.deepEqual(transportCalls, ["play"]);

console.log(`Dialogue director verified: ${DIALOGUE_VOICES.length} voices, bilingual routing, AudioContext-mastered captions, latency compensation, and deterministic actions.`);
