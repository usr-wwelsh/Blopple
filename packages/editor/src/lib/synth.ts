import type { Instrument, Song, DrumType } from "@blopple/shared";
import { STEPS_PER_PATTERN } from "@blopple/shared";

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

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteName(semitone: number): string {
  const octave = 4 + Math.floor(semitone / 12);
  const idx = ((semitone % 12) + 12) % 12;
  return `${NOTE_NAMES[idx]}${octave}`;
}

export function noteToFrequency(note: number): number {
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

export function playInstrument(instrument: Instrument, note: number, when: number, duration: number, dest?: AudioNode): void {
  const actx = getCtx();
  const target = dest ?? actx.destination;

  if (instrument.kind === "drum") {
    playDrum(actx, target, instrument.drumType, when, instrument.volume);
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
    osc.connect(filter).connect(gain).connect(target);
  } else {
    osc.connect(gain).connect(target);
  }

  const stopAt = applyEnvelope(gain, when, instrument.attack, instrument.decay, instrument.sustain, instrument.release, duration, instrument.volume);
  osc.start(when);
  osc.stop(stopAt + 0.05);
}

export function previewInstrument(instrument: Instrument, note = 0): void {
  const actx = getCtx();
  if (actx.state === "suspended") actx.resume();
  playInstrument(instrument, note, actx.currentTime + 0.02, 0.3);
}

export class SongPlayer {
  private song: Song;
  private timerId: number | null = null;
  private nextStepTime = 0;
  private orderIndex = 0;
  private stepIndex = 0;
  playing = false;
  onStep?: (orderIndex: number, stepIndex: number) => void;

  constructor(song: Song) {
    this.song = song;
  }

  private stepDuration(): number {
    return 60 / this.song.bpm / 4;
  }

  start(): void {
    if (this.song.order.length === 0 || this.playing) return;
    const actx = getCtx();
    if (actx.state === "suspended") actx.resume();
    this.playing = true;
    this.orderIndex = 0;
    this.stepIndex = 0;
    this.nextStepTime = actx.currentTime + 0.05;
    this.tick();
  }

  stop(): void {
    this.playing = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private tick = (): void => {
    if (!this.playing) return;
    const actx = getCtx();
    const lookahead = 0.2;
    while (this.nextStepTime < actx.currentTime + lookahead) {
      this.scheduleStep(this.nextStepTime);
      const capturedOrder = this.orderIndex;
      const capturedStep = this.stepIndex;
      const delayMs = Math.max(0, (this.nextStepTime - actx.currentTime) * 1000);
      if (this.onStep) window.setTimeout(() => this.playing && this.onStep?.(capturedOrder, capturedStep), delayMs);

      this.nextStepTime += this.stepDuration();
      this.stepIndex++;
      if (this.stepIndex >= STEPS_PER_PATTERN) {
        this.stepIndex = 0;
        this.orderIndex = (this.orderIndex + 1) % this.song.order.length;
      }
    }
    this.timerId = window.setTimeout(this.tick, 25);
  };

  private scheduleStep(when: number): void {
    const patternId = this.song.order[this.orderIndex];
    const pattern = this.song.patterns.find((p) => p.id === patternId);
    if (!pattern) return;
    const duration = this.stepDuration() * 0.9;
    pattern.rows.forEach((row, i) => {
      const note = row[this.stepIndex];
      if (note === undefined || note < 0) return;
      const instrument = this.song.instruments[i];
      if (!instrument) return;
      playInstrument(instrument, note, when, duration);
    });
  }
}
