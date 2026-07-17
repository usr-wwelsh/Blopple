export const MUSIC_SCHEMA_VERSION = 1;
export const STEPS_PER_PATTERN = 16;

export type InstrumentKind = "synth" | "string" | "brass" | "drum";
export type Waveform = "sine" | "square" | "sawtooth" | "triangle";
export type DrumType = "kick" | "snare" | "hihat" | "clap";
export type FilterType = "none" | "lowpass" | "highpass" | "bandpass";

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
  /** 0-1, blends in white noise with the oscillator; used when kind !== "drum" */
  noiseMix: number;
  filterType: FilterType;
  /** Hz, 20-20000 */
  filterCutoff: number;
  /** resonance, 0.1-20 */
  filterQ: number;
  /** octaves the cutoff sweeps down from (filterCutoff * 2^filterEnvAmount) to filterCutoff
   *  over attack+decay; 0 disables the sweep, negative sweeps the cutoff upward instead */
  filterEnvAmount: number;
  /** semitones the pitch starts above the target note and decays down to it over attack+decay;
   *  0 disables the sweep */
  pitchDecay: number;
  /** 0-1 waveshaper drive/grit */
  distortion: number;
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

export interface SfxLayer {
  id: string;
  instrument: Instrument;
  note: number;
  /** seconds after the sfx triggers before this layer starts, for staggering stacked hits */
  delay: number;
  /** 0-1, multiplies this layer's instrument volume so layers can be balanced independently */
  gain: number;
}

export interface SfxDef {
  schemaVersion: typeof MUSIC_SCHEMA_VERSION;
  id: string;
  name: string;
  category: "weapon" | "enemy" | "other";
  /** stacked sounds played together (with per-layer delay) when this sfx fires */
  layers: SfxLayer[];
}

export interface MapMusicSettings {
  /** Song id looped for the duration of gameplay, from level start until the exit is reached. */
  gameplaySongId: string | null;
  /** Song id looped once the player reaches the exit, in place of the gameplay song. */
  outroSongId: string | null;
}
