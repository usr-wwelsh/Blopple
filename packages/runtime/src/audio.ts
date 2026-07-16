import type { MapData } from "@blopple/shared";
import { playSfxLayers } from "@blopple/shared";

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
