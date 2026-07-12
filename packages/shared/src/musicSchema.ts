export const MUSIC_SCHEMA_VERSION = 1;
export const STEPS_PER_PATTERN = 16;

export type InstrumentKind = "synth" | "string" | "brass" | "drum";
export type Waveform = "square" | "sawtooth" | "triangle";
export type DrumType = "kick" | "snare" | "hihat" | "clap";

export interface Instrument {
  id: string;
  name: string;
  kind: InstrumentKind;
  /** used when kind !== "drum" */
  waveform: Waveform;
  /** used when kind === "drum" */
  drumType: DrumType;
  attack: number;
  decay: number;
  /** sustain level, 0-1 */
  sustain: number;
  release: number;
  /** 0-1 */
  volume: number;
}

export interface Pattern {
  id: string;
  name: string;
  /** one row per Song.instruments entry (same index); note = semitones from C4, -1 = rest */
  rows: number[][];
}

export interface Song {
  schemaVersion: typeof MUSIC_SCHEMA_VERSION;
  id: string;
  name: string;
  bpm: number;
  instruments: Instrument[];
  patterns: Pattern[];
  /** sequence of pattern ids forming the arrangement, played in order and looped */
  order: string[];
}

export interface SfxDef {
  schemaVersion: typeof MUSIC_SCHEMA_VERSION;
  id: string;
  name: string;
  category: "weapon" | "enemy" | "other";
  instrument: Instrument;
  note: number;
}
