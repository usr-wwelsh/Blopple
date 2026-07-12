import type { Instrument } from "@blopple/shared";

type Preset = { label: string; make: () => Omit<Instrument, "id"> };

export const INSTRUMENT_PRESETS: Preset[] = [
  {
    label: "Square Synth",
    make: () => ({ name: "Square Synth", kind: "synth", waveform: "square", drumType: "kick", attack: 0.01, decay: 0.05, sustain: 0.6, release: 0.1, volume: 0.5 }),
  },
  {
    label: "Saw Synth",
    make: () => ({ name: "Saw Synth", kind: "synth", waveform: "sawtooth", drumType: "kick", attack: 0.01, decay: 0.08, sustain: 0.5, release: 0.15, volume: 0.45 }),
  },
  {
    label: "Triangle Lead",
    make: () => ({ name: "Triangle Lead", kind: "synth", waveform: "triangle", drumType: "kick", attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.1, volume: 0.5 }),
  },
  {
    label: "String Pad",
    make: () => ({ name: "String Pad", kind: "string", waveform: "triangle", drumType: "kick", attack: 0.4, decay: 0.2, sustain: 0.8, release: 0.6, volume: 0.4 }),
  },
  {
    label: "Brass",
    make: () => ({ name: "Brass", kind: "brass", waveform: "sawtooth", drumType: "kick", attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.2, volume: 0.45 }),
  },
  {
    label: "Kick",
    make: () => ({ name: "Kick", kind: "drum", waveform: "square", drumType: "kick", attack: 0, decay: 0, sustain: 0, release: 0, volume: 0.9 }),
  },
  {
    label: "Snare",
    make: () => ({ name: "Snare", kind: "drum", waveform: "square", drumType: "snare", attack: 0, decay: 0, sustain: 0, release: 0, volume: 0.8 }),
  },
  {
    label: "Hi-Hat",
    make: () => ({ name: "Hi-Hat", kind: "drum", waveform: "square", drumType: "hihat", attack: 0, decay: 0, sustain: 0, release: 0, volume: 0.6 }),
  },
  {
    label: "Clap",
    make: () => ({ name: "Clap", kind: "drum", waveform: "square", drumType: "clap", attack: 0, decay: 0, sustain: 0, release: 0, volume: 0.7 }),
  },
];
