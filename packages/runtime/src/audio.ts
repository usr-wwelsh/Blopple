import type { MapData } from "@blopple/shared";
import { playSfxLayers, SongPlayer, parseMusicRef } from "@blopple/shared";

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
let trackSource: AudioBufferSourceNode | null = null;
let musicRef: string | null = null;

/** Loops the given music ref ("song:<id>" | "track:<id>", see parseMusicRef), replacing
 * whatever's currently playing — a no-op if that ref is already playing (safe to call every
 * frame, e.g. "gameplay song until exit reached, then outro song"). Pass null to stop music. */
export function playMusic(map: MapData, ref: string | null): void {
  if (ref === musicRef) return;
  musicPlayer?.stop();
  musicPlayer = null;
  trackSource?.stop();
  trackSource = null;
  musicRef = ref;
  const parsed = parseMusicRef(ref);
  if (!parsed) return;
  const actx = getCtx();
  if (actx.state === "suspended") actx.resume();

  if (parsed.kind === "song") {
    const song = map.songs.find((s) => s.id === parsed.id);
    if (!song) return;
    musicPlayer = new SongPlayer(actx, song);
    musicPlayer.start();
    return;
  }

  const track = map.audioTracks.find((t) => t.id === parsed.id);
  if (!track) return;
  const requestedRef = ref;
  fetch(track.dataUrl)
    .then((r) => r.arrayBuffer())
    .then((buf) => actx.decodeAudioData(buf))
    .then((audioBuffer) => {
      if (musicRef !== requestedRef) return; // superseded while decoding
      const source = actx.createBufferSource();
      source.buffer = audioBuffer;
      source.loop = true;
      source.connect(actx.destination);
      source.start();
      trackSource = source;
    });
}
