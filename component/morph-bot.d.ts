export type MorphBotState = "sleeping" | "waking" | "idle" | "listening" | "thinking" | "searching" | "working" | "excited" | "surprised" | "suspicious" | "angry" | "drowsy" | "happy" | "curious" | "confused" | "bored" | "proud" | "shy" | "sad" | "laughing" | "scared" | "playful" | "celebrate" | "orbit" | "radar" | "progress" | "spawning" | "humming" | "loading" | "dictating" | "writing" | "sending" | "receiving" | "uploading" | "notifying" | "alerting" | "dragging" | "bouncing" | "powering-down";
export type MorphBotShape = "blob" | "pebble" | "bean" | "egg" | "squircle" | "tablet" | "capsule" | "cylinder" | "hex" | "gem" | "crystal" | "wedge" | "shield" | "dome" | "arch" | "cloud" | "teardrop" | "leaf";
export type MorphBotEffect = "dots" | "orbit" | "radar" | "progress" | "gather" | "wave" | "send" | "receive" | "dock" | "ball" | "whirl" | "pencil" | "bang" | "standby";

export interface MorphBotProject {
  version?: number;
  shape?: MorphBotShape;
  character?: Record<string, unknown>;
  states?: Partial<Record<MorphBotState, Record<string, unknown>>>;
}

export class MorphBotElement extends HTMLElement {
  state: MorphBotState;
  shape: MorphBotShape;
  size: number;
  speed: number;
  paused: boolean;
  configure(project: MorphBotProject): this;
  setState(state: MorphBotState, options?: { replay?: boolean }): this;
  setShape(shape: MorphBotShape): this;
  replay(): this;
  pause(): this;
  play(): this;
  step(): this;
  restoreStateMorph(): this;
  playMorph(effect: MorphBotEffect, options?: { hold?: number; restore?: MorphBotState | "default" | null }): Promise<{ cancelled?: boolean; effect?: MorphBotEffect; restored?: string | null }>;
  snapshot(): Record<string, unknown> | null;
}

export const MORPH_BOT_STATES: readonly MorphBotState[];
export const MORPH_BOT_SHAPES: readonly MorphBotShape[];
export const MORPH_BOT_EFFECTS: readonly MorphBotEffect[];
export const MORPH_BY_STATE: Readonly<Partial<Record<MorphBotState, MorphBotEffect>>>;

declare global {
  interface HTMLElementTagNameMap {
    "morph-bot": MorphBotElement;
  }
}

export default MorphBotElement;
