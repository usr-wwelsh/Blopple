import type { Instrument } from "@blopple/shared";

type Preset = { label: string; make: () => Omit<Instrument, "id"> };

const NEUTRAL = { noiseMix: 0, filterType: "none", filterCutoff: 20000, filterQ: 1, filterEnvAmount: 0, pitchDecay: 0, distortion: 0 } as const;

export const INSTRUMENT_PRESETS: Preset[] = [
  {
    label: "Square Synth",
    make: () => ({ name: "Square Synth", kind: "synth", waveform: "square", drumType: "kick", attack: 0.01, decay: 0.05, sustain: 0.6, release: 0.1, volume: 0.5, ...NEUTRAL }),
  },
  {
    label: "Saw Synth",
    make: () => ({ name: "Saw Synth", kind: "synth", waveform: "sawtooth", drumType: "kick", attack: 0.01, decay: 0.08, sustain: 0.5, release: 0.15, volume: 0.45, ...NEUTRAL }),
  },
  {
    label: "Triangle Lead",
    make: () => ({ name: "Triangle Lead", kind: "synth", waveform: "triangle", drumType: "kick", attack: 0.01, decay: 0.05, sustain: 0.7, release: 0.1, volume: 0.5, ...NEUTRAL }),
  },
  {
    label: "String Pad",
    make: () => ({ name: "String Pad", kind: "string", waveform: "triangle", drumType: "kick", attack: 0.4, decay: 0.2, sustain: 0.8, release: 0.6, volume: 0.4, ...NEUTRAL }),
  },
  {
    label: "Brass",
    make: () => ({
      name: "Brass",
      kind: "brass",
      waveform: "sawtooth",
      drumType: "kick",
      attack: 0.05,
      decay: 0.1,
      sustain: 0.7,
      release: 0.2,
      volume: 0.45,
      ...NEUTRAL,
      filterType: "lowpass",
      filterCutoff: 2200,
      filterQ: 4,
    }),
  },
  {
    label: "Kick",
    make: () => ({ name: "Kick", kind: "drum", waveform: "square", drumType: "kick", attack: 0, decay: 0, sustain: 0, release: 0, volume: 0.9, ...NEUTRAL }),
  },
  {
    label: "Snare",
    make: () => ({ name: "Snare", kind: "drum", waveform: "square", drumType: "snare", attack: 0, decay: 0, sustain: 0, release: 0, volume: 0.8, ...NEUTRAL }),
  },
  {
    label: "Hi-Hat",
    make: () => ({ name: "Hi-Hat", kind: "drum", waveform: "square", drumType: "hihat", attack: 0, decay: 0, sustain: 0, release: 0, volume: 0.6, ...NEUTRAL }),
  },
  {
    label: "Clap",
    make: () => ({ name: "Clap", kind: "drum", waveform: "square", drumType: "clap", attack: 0, decay: 0, sustain: 0, release: 0, volume: 0.7, ...NEUTRAL }),
  },
  {
    label: "Noise Wall",
    make: () => ({
      name: "Noise Wall",
      kind: "synth",
      waveform: "sawtooth",
      drumType: "kick",
      attack: 0.001,
      decay: 0.3,
      sustain: 0.1,
      release: 0.5,
      volume: 0.8,
      noiseMix: 1,
      filterType: "lowpass",
      filterCutoff: 4000,
      filterQ: 1,
      filterEnvAmount: 4,
      pitchDecay: 0,
      distortion: 0.5,
    }),
  },
  {
    label: "Sub Boom",
    make: () => ({
      name: "Sub Boom",
      kind: "synth",
      waveform: "sine",
      drumType: "kick",
      attack: 0.001,
      decay: 0.25,
      sustain: 0.2,
      release: 0.3,
      volume: 0.9,
      noiseMix: 0,
      filterType: "lowpass",
      filterCutoff: 300,
      filterQ: 1,
      filterEnvAmount: 0,
      pitchDecay: 12,
      distortion: 0.2,
    }),
  },
];
