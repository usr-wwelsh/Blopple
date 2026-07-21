import type { IntroOutroConfig, MapData } from "@blopple/shared";
import { parseTextureRef } from "@blopple/shared";
import { textureCanvasFor } from "./textureCanvas";

const BG_FALLBACK = "#000000";

/** Fills the screen with the configured background: a flat color, a texture tiled at its
 * native 64x64 resolution (canvas pattern, no manual loop needed), or a texture stretched
 * to fill the screen (chunky/retro on purpose — same pixel source as wall/floor textures).
 * Always paints an opaque BG_FALLBACK base first — a texture's null (transparent) pixels
 * leave holes in the tiled pattern, and since this canvas is never cleared between frames,
 * skipping the base fill let those holes show whatever was painted last frame (the crawl
 * text sweeping past) instead of a solid backdrop. */
function renderBackground(ctx: CanvasRenderingContext2D, map: MapData, config: IntroOutroConfig, width: number, height: number): void {
  ctx.fillStyle = BG_FALLBACK;
  ctx.fillRect(0, 0, width, height);

  const parsed = parseTextureRef(config.backgroundId);
  if (!parsed) return;
  if (parsed.kind === "color") {
    ctx.fillStyle = parsed.color;
    ctx.fillRect(0, 0, width, height);
    return;
  }

  const texture = map.textures.find((t) => t.id === parsed.id);
  if (!texture) return;

  const canvas = textureCanvasFor(texture);
  ctx.imageSmoothingEnabled = false;
  if (config.backgroundMode === "stretch") {
    ctx.drawImage(canvas, 0, 0, width, height);
    return;
  }
  const pattern = ctx.createPattern(canvas, "repeat");
  if (!pattern) return;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, width, height);
}

const CRAWL_SPEED_PX_PER_SEC = 40;
const CRAWL_LINE_HEIGHT_RATIO = 0.07;
// extra screen-heights of blank space between the last line exiting the top and the
// crawl restarting from the bottom, so it doesn't loop back-to-back with no breather
const CRAWL_LOOP_GAP_RATIO = 1;

/** Doom/Star Wars-style vertical text crawl: lines drift upward from the bottom of the
 * screen and loop forever (elapsedMs just wraps modulo the total scroll distance), since
 * both the intro (waiting for input) and outro (frozen at level-complete) may sit on
 * screen indefinitely. */
function renderCrawl(
  ctx: CanvasRenderingContext2D,
  text: string[],
  textColor: string,
  elapsedMs: number,
  width: number,
  height: number,
): void {
  if (text.length === 0) return;
  const lineHeight = Math.max(14, Math.round(height * CRAWL_LINE_HEIGHT_RATIO));
  const loopDistance = text.length * lineHeight + height * (1 + CRAWL_LOOP_GAP_RATIO);
  const scrolled = ((elapsedMs / 1000) * CRAWL_SPEED_PX_PER_SEC) % loopDistance;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(lineHeight * 0.7)}px monospace`;
  ctx.fillStyle = textColor;
  for (let i = 0; i < text.length; i++) {
    const y = height - scrolled + i * lineHeight;
    if (y < -lineHeight || y > height + lineHeight) continue;
    ctx.fillText(text[i], width / 2, y);
  }
}

const HINT_COLOR = "#999999";
const HINT_BLINK_MS = 1000;
const HINT_BLINK_ON_MS = 650;

/** Full-screen intro or outro screen: background, text crawl, and an optional blinking
 * hint pinned to the bottom (e.g. "PRESS ANY KEY TO START"); pass null for none. */
export function renderIntroOutroScreen(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  config: IntroOutroConfig,
  elapsedMs: number,
  width: number,
  height: number,
  hint: string | null,
): void {
  renderBackground(ctx, map, config, width, height);
  renderCrawl(ctx, config.text, config.textColor, elapsedMs, width, height);

  if (hint && elapsedMs % HINT_BLINK_MS < HINT_BLINK_ON_MS) {
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = HINT_COLOR;
    ctx.font = `${Math.round(height * 0.035)}px monospace`;
    ctx.fillText(hint, width / 2, height - height * 0.04);
  }
}
