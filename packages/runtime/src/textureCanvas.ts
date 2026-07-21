import type { TextureDef } from "@blopple/shared";
import { TEXTURE_SIZE } from "@blopple/shared";

// rebuilt lazily per texture and reused across frames — same pattern as MapGrid.svelte's
// textureCanvasCache in the editor, just scoped to the runtime instead
const cache = new WeakMap<TextureDef, HTMLCanvasElement>();

/** Rasterizes a TextureDef's 64x64 pixel array into a canvas, cached per texture object.
 * Shared by the viewmodel sprite (hud.ts) and the intro/outro background (introOutro.ts). */
export function textureCanvasFor(tex: TextureDef): HTMLCanvasElement {
  let canvas = cache.get(tex);
  if (canvas) return canvas;
  canvas = document.createElement("canvas");
  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d")!;
  for (let y = 0; y < TEXTURE_SIZE; y++) {
    for (let x = 0; x < TEXTURE_SIZE; x++) {
      const c = tex.pixels[y * TEXTURE_SIZE + x];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  cache.set(tex, canvas);
  return canvas;
}
