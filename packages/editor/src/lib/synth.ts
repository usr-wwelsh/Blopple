import type { Song, SfxDef } from "@blopple/shared";
import { playInstrument as playInstrumentAt, playSfxLayers, SongPlayer } from "@blopple/shared";
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

export { SongPlayer };

export function createSongPlayer(song: Song): SongPlayer {
  return new SongPlayer(getCtx(), song);
}
