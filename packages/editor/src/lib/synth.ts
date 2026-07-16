import type { Song, SfxDef } from "@blopple/shared";
import { STEPS_PER_PATTERN, playInstrument as playInstrumentAt, playSfxLayers } from "@blopple/shared";
import type { Instrument } from "@blopple/shared";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

export function noteName(semitone: number): string {
  const octave = 4 + Math.floor(semitone / 12);
  const idx = ((semitone % 12) + 12) % 12;
  return `${NOTE_NAMES[idx]}${octave}`;
}

export function previewInstrument(instrument: Instrument, note = 0): void {
  const actx = getCtx();
  if (actx.state === "suspended") actx.resume();
  playInstrumentAt(actx, actx.destination, instrument, note, actx.currentTime + 0.02, 0.3);
}

export function previewSfx(sfx: SfxDef): void {
  const actx = getCtx();
  if (actx.state === "suspended") actx.resume();
  playSfxLayers(actx, actx.destination, sfx.layers, actx.currentTime + 0.02, 0.3);
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
    const actx = getCtx();
    pattern.rows.forEach((row, i) => {
      const note = row[this.stepIndex];
      if (note === undefined || note < 0) return;
      const instrument = this.song.instruments[i];
      if (!instrument) return;
      playInstrumentAt(actx, actx.destination, instrument, note, when, duration);
    });
  }
}
