import type { DrumType, Instrument, MapData } from "@blopple/shared";

// Minimal one-shot Web Audio player for in-game SFX (weapon fire, etc). Deliberately not
// shared with the editor's synth.ts (which also does full song/pattern playback) — this is
// a small, self-contained subset scoped to "play this one instrument+note right now."

let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function getNoiseBuffer(actx: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer;
  const buf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buf;
  return buf;
}

function noteToFrequency(note: number): number {
  return 261.6256 * Math.pow(2, note / 12);
}

function applyEnvelope(
  gain: GainNode,
  when: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  duration: number,
  peak: number,
): number {
  const g = gain.gain;
  const sustainStart = when + Math.max(attack, 0.001);
  const sustainLevelTime = sustainStart + Math.max(decay, 0);
  const holdEnd = Math.max(sustainLevelTime, when + duration);
  g.cancelScheduledValues(when);
  g.setValueAtTime(0, when);
  g.linearRampToValueAtTime(peak, sustainStart);
  g.linearRampToValueAtTime(peak * sustain, sustainLevelTime);
  g.setValueAtTime(peak * sustain, holdEnd);
  g.linearRampToValueAtTime(0, holdEnd + Math.max(release, 0.001));
  return holdEnd + release;
}

function playDrum(actx: AudioContext, dest: AudioNode, drumType: DrumType, when: number, volume: number): void {
  switch (drumType) {
    case "kick": {
      const osc = actx.createOscillator();
      osc.type = "sine";
      const gain = actx.createGain();
      osc.connect(gain).connect(dest);
      osc.frequency.setValueAtTime(150, when);
      osc.frequency.exponentialRampToValueAtTime(40, when + 0.15);
      gain.gain.setValueAtTime(volume, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.3);
      osc.start(when);
      osc.stop(when + 0.32);
      break;
    }
    case "snare": {
      const src = actx.createBufferSource();
      src.buffer = getNoiseBuffer(actx);
      const filter = actx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 1800;
      const gain = actx.createGain();
      src.connect(filter).connect(gain).connect(dest);
      gain.gain.setValueAtTime(volume, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.15);
      src.start(when);
      src.stop(when + 0.16);
      break;
    }
    case "hihat": {
      const src = actx.createBufferSource();
      src.buffer = getNoiseBuffer(actx);
      const filter = actx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = 7000;
      const gain = actx.createGain();
      src.connect(filter).connect(gain).connect(dest);
      gain.gain.setValueAtTime(volume * 0.8, when);
      gain.gain.exponentialRampToValueAtTime(0.001, when + 0.05);
      src.start(when);
      src.stop(when + 0.06);
      break;
    }
    case "clap": {
      for (const offset of [0, 0.015, 0.03]) {
        const src = actx.createBufferSource();
        src.buffer = getNoiseBuffer(actx);
        const filter = actx.createBiquadFilter();
        filter.type = "bandpass";
        filter.frequency.value = 1200;
        const gain = actx.createGain();
        src.connect(filter).connect(gain).connect(dest);
        const t = when + offset;
        gain.gain.setValueAtTime(volume * 0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
        src.start(t);
        src.stop(t + 0.13);
      }
      break;
    }
  }
}

function playInstrument(instrument: Instrument, note: number, when: number, duration: number): void {
  const actx = getCtx();
  const dest = actx.destination;

  if (instrument.kind === "drum") {
    playDrum(actx, dest, instrument.drumType, when, instrument.volume);
    return;
  }

  const osc = actx.createOscillator();
  osc.type = instrument.waveform;
  osc.frequency.value = noteToFrequency(note);
  const gain = actx.createGain();

  if (instrument.kind === "brass") {
    const filter = actx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2200;
    filter.Q.value = 4;
    osc.connect(filter).connect(gain).connect(dest);
  } else {
    osc.connect(gain).connect(dest);
  }

  const stopAt = applyEnvelope(gain, when, instrument.attack, instrument.decay, instrument.sustain, instrument.release, duration, instrument.volume);
  osc.start(when);
  osc.stop(stopAt + 0.05);
}

/** Fires an SfxDef by id, if present. No-ops silently if sfxId is null/missing — callers
 * don't need to guard, e.g. a weapon with no fire sound configured just stays quiet. */
export function playSfx(map: MapData, sfxId: string | null): void {
  if (!sfxId) return;
  const sfx = map.sfx.find((s) => s.id === sfxId);
  if (!sfx) return;
  const actx = getCtx();
  if (actx.state === "suspended") actx.resume();
  playInstrument(sfx.instrument, sfx.note, actx.currentTime + 0.01, 0.2);
}
