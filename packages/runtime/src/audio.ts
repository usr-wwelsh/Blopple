import type { MapData } from "@blopple/shared";
import { playSfxLayers, SongPlayer } from "@blopple/shared";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Fires an SfxDef by id, if present. No-ops silently if sfxId is null/missing — callers
 * don't need to guard, e.g. a weapon with no fire sound configured just stays quiet. */
export function playSfx(map: MapData, sfxId: string | null): void {
  if (!sfxId) return;
  const sfx = map.sfx.find((s) => s.id === sfxId);
  if (!sfx) return;
  const actx = getCtx();
  if (actx.state === "suspended") actx.resume();
  playSfxLayers(actx, actx.destination, sfx.layers, actx.currentTime + 0.01, 0.2);
}

let musicPlayer: SongPlayer | null = null;
let musicSongId: string | null = null;

/** Loops the given song id, replacing whatever's currently playing — a no-op if that song
 * is already playing (safe to call every frame, e.g. "gameplay song until exit reached, then
 * outro song"). Pass null to stop music entirely. */
export function playMusic(map: MapData, songId: string | null): void {
  if (songId === musicSongId) return;
  musicPlayer?.stop();
  musicPlayer = null;
  musicSongId = songId;
  const song = songId ? map.songs.find((s) => s.id === songId) : undefined;
  if (!song) return;
  const actx = getCtx();
  if (actx.state === "suspended") actx.resume();
  musicPlayer = new SongPlayer(actx, song);
  musicPlayer.start();
}
