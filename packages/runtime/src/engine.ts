import type { Cell, HeightLevel, KeyColor, KeyPickup, MapData, TextureDef, WeaponPickup } from "@blopple/shared";
import { EXIT_COLOR_HEX, KEY_COLOR_HEX, TEXTURE_SIZE, parseTextureRef } from "@blopple/shared";

export const HEIGHT_STEP = 0.5;
export const CEILING_Y = 1.6;
export const EYE_OFFSET = 0.35;

const MAX_RENDER_DIST = 15;

// Upper bound on how many bands renderPlaneSegment subdivides a floor/ceiling segment
// into. The single nearest floor+ceiling segment (the cell right under the player) always
// has a large on-screen span regardless of how much of the *rest* of the floor got merged
// into one run (see renderFrame's floor-run coalescing) — it renders every column, every
// frame, so this cap bounds its cost independent of segment count. 128 is double the
// original 64: cheap enough for that always-present segment, but fine enough that a long
// merged run (which used to be many small, naturally-fine-grained segments before
// coalescing) doesn't visibly block into flat bands.
const MAX_PLANE_BANDS = 128;

// x/y -> Cell index, memoized per map object. Cell mutations happen in place
// (same object, x/y never change) so a cached index stays valid across frames —
// only rebuilt if a *different* MapData object is passed in.
const cellIndexCache = new WeakMap<MapData, Map<string, Cell>>();

function cellIndexFor(map: MapData): Map<string, Cell> {
  let index = cellIndexCache.get(map);
  if (!index) {
    index = new Map();
    for (const cell of map.cells) index.set(`${cell.x},${cell.y}`, cell);
    cellIndexCache.set(map, index);
  }
  return index;
}

export function cellAt(map: MapData, x: number, y: number): Cell | null {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  return cellIndexFor(map).get(`${cx},${cy}`) ?? null;
}

// keyed on textures.length too — cells never change count after load, but textures can be
// added/removed live while playtesting, which a pure object-identity cache would miss
const textureIndexCache = new WeakMap<MapData, { size: number; index: Map<string, TextureDef> }>();

function textureIndexFor(map: MapData): Map<string, TextureDef> {
  const cached = textureIndexCache.get(map);
  if (cached && cached.size === map.textures.length) return cached.index;
  const index = new Map<string, TextureDef>();
  for (const tex of map.textures) index.set(tex.id, tex);
  textureIndexCache.set(map, { size: map.textures.length, index });
  return index;
}

/** A door blocks like a wall until its matching key opens it (see player.ts). */
function isLockedDoor(cell: Cell): boolean {
  return cell.doorColor !== null && !cell.doorOpen;
}

export function isSolid(map: MapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return true;
  const cell = cellAt(map, x, y);
  return cell === null || cell.wallTextureId !== null || isLockedDoor(cell);
}

export function floorHeightAt(map: MapData, x: number, y: number): HeightLevel {
  return cellAt(map, x, y)?.height ?? 0;
}

/** Lightweight DDA grid march for a single arbitrary ray (hitscan/projectile use, not
 * rendering) — unlike castColumn, dirX/dirY here is expected to be a unit vector, so the
 * returned distance is true Euclidean distance, and there's no per-step height/side
 * bookkeeping since callers only care where the ray first goes solid. */
export function raycastWallDistance(
  map: MapData,
  x: number,
  y: number,
  dirX: number,
  dirY: number,
  maxDist: number,
): number {
  let mapX = Math.floor(x);
  let mapY = Math.floor(y);

  const deltaDistX = dirX === 0 ? Infinity : Math.abs(1 / dirX);
  const deltaDistY = dirY === 0 ? Infinity : Math.abs(1 / dirY);

  const stepX = dirX < 0 ? -1 : 1;
  const stepY = dirY < 0 ? -1 : 1;

  let sideDistX = dirX < 0 ? (x - mapX) * deltaDistX : (mapX + 1 - x) * deltaDistX;
  let sideDistY = dirY < 0 ? (y - mapY) * deltaDistY : (mapY + 1 - y) * deltaDistY;

  const maxSteps = map.width + map.height;
  for (let i = 0; i < maxSteps; i++) {
    let dist: number;
    if (sideDistX < sideDistY) {
      dist = sideDistX;
      sideDistX += deltaDistX;
      mapX += stepX;
    } else {
      dist = sideDistY;
      sideDistY += deltaDistY;
      mapY += stepY;
    }
    if (dist > maxDist) return maxDist;
    if (isSolid(map, mapX, mapY)) return dist;
  }
  return maxDist;
}

// x/y -> KeyPickup, memoized per map object like cellIndexFor — only rebuilt if map.keyPickups.length
// changes (a pickup is removed from *rendering* by heldKeys, never by mutating this array).
const keyPickupIndexCache = new WeakMap<MapData, { size: number; index: Map<string, KeyPickup> }>();

function keyPickupIndexFor(map: MapData): Map<string, KeyPickup> {
  const cached = keyPickupIndexCache.get(map);
  if (cached && cached.size === map.keyPickups.length) return cached.index;
  const index = new Map<string, KeyPickup>();
  for (const pickup of map.keyPickups) index.set(`${Math.floor(pickup.x)},${Math.floor(pickup.y)}`, pickup);
  keyPickupIndexCache.set(map, { size: map.keyPickups.length, index });
  return index;
}

// x/y -> WeaponPickup, memoized per map object like keyPickupIndexFor
const weaponPickupIndexCache = new WeakMap<MapData, { size: number; index: Map<string, WeaponPickup> }>();

function weaponPickupIndexFor(map: MapData): Map<string, WeaponPickup> {
  const cached = weaponPickupIndexCache.get(map);
  if (cached && cached.size === map.weaponPickups.length) return cached.index;
  const index = new Map<string, WeaponPickup>();
  for (const pickup of map.weaponPickups) index.set(`${Math.floor(pickup.x)},${Math.floor(pickup.y)}`, pickup);
  weaponPickupIndexCache.set(map, { size: map.weaponPickups.length, index });
  return index;
}

export interface Camera {
  x: number;
  y: number;
  angle: number;
  fov: number;
}

/** A billboard sprite anchored to a floor cell — always faces the camera, Doom-style.
 * Deliberately generic (no enemyId/behavior here): the engine renders billboards, it
 * doesn't know what an "enemy" is. Callers resolve their own domain objects into these. */
export interface Billboard {
  x: number;
  y: number;
  /** ref format matches wallTextureId etc: "texture:<id>" | "color:#rrggbb" | null.
   * A "color:" ref draws a solid rectangle (no cutout shape); only a texture ref gets
   * per-pixel transparency from its null pixels. */
  textureRef: string | null;
  /** world units, stands on the floor of its cell — see floorHeightAt in renderBillboards */
  worldWidth: number;
  worldHeight: number;
  /** blends the rendered pixel toward `color` by `strength` (0-1) before fog is applied —
   * used for transient effects like a hit flash; omit/null for no tint. */
  tint?: { color: string; strength: number } | null;
}

interface StepHit {
  dist: number;
  height: HeightLevel;
  cell: Cell | null;
  side: 0 | 1;
}

interface ColumnHit {
  steps: StepHit[];
  hitDist: number;
  wallCell: Cell | null;
  side: 0 | 1;
}

/** DDA grid march: walks cell-by-cell along the ray, recording floor-height
 * transitions (for step risers) until it reaches a solid cell or the map edge.
 * rayDirX/Y come from the camera-plane method (see renderFrame), not a unit
 * angle vector — their non-unit length is what makes the DDA distance already
 * perpendicular to the camera plane, with no separate fisheye correction needed. */
function castColumn(map: MapData, camera: Camera, rayDirX: number, rayDirY: number): ColumnHit {
  let mapX = Math.floor(camera.x);
  let mapY = Math.floor(camera.y);

  const deltaDistX = rayDirX === 0 ? Infinity : Math.abs(1 / rayDirX);
  const deltaDistY = rayDirY === 0 ? Infinity : Math.abs(1 / rayDirY);

  const stepX = rayDirX < 0 ? -1 : 1;
  const stepY = rayDirY < 0 ? -1 : 1;

  let sideDistX = rayDirX < 0 ? (camera.x - mapX) * deltaDistX : (mapX + 1 - camera.x) * deltaDistX;
  let sideDistY = rayDirY < 0 ? (camera.y - mapY) * deltaDistY : (mapY + 1 - camera.y) * deltaDistY;

  const startCell = cellAt(map, camera.x, camera.y);
  const steps: StepHit[] = [{ dist: 0, height: startCell?.height ?? 0, cell: startCell, side: 0 }];
  let side: 0 | 1 = 0;
  let hitDist = MAX_RENDER_DIST;
  let wallCell: Cell | null = null;

  const maxSteps = map.width + map.height;
  for (let i = 0; i < maxSteps; i++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    const perpDist = side === 0 ? sideDistX - deltaDistX : sideDistY - deltaDistY;
    if (perpDist > MAX_RENDER_DIST) break;

    if (mapX < 0 || mapY < 0 || mapX >= map.width || mapY >= map.height) {
      hitDist = perpDist;
      break;
    }

    const cell = cellAt(map, mapX, mapY);
    if (!cell || cell.wallTextureId !== null || isLockedDoor(cell)) {
      hitDist = perpDist;
      wallCell = cell;
      break;
    }

    steps.push({ dist: perpDist, height: cell.height, cell, side });
  }

  return { steps, hitDist, wallCell, side };
}

// keyed by hex string — the same handful of colors get sampled millions of
// times a frame (every texel, every fog-shaded pixel), so avoid re-running
// the regex/parseInt for repeats
const hexRgbCache = new Map<string, [number, number, number]>();

function hexToRgb(hex: string): [number, number, number] {
  const cached = hexRgbCache.get(hex);
  if (cached) return cached;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  let rgb: [number, number, number];
  if (m) {
    const n = parseInt(m[1], 16);
    rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  } else {
    rgb = [136, 136, 136];
  }
  hexRgbCache.set(hex, rgb);
  return rgb;
}

/** Flat-color fallback for refs — used for "color:" refs, missing refs, and
 * texture refs that don't resolve to a TextureDef. */
function refColor(ref: string | null, fallback: string): string {
  if (!ref) return fallback;
  return ref.startsWith("color:") ? ref.slice(6) : "#777777";
}

// Reused across frames, only reallocated when the canvas size changes — avoids
// GC churn from allocating a fresh width*height*4 buffer every frame. buf32 is a
// Uint32Array view over the same backing ArrayBuffer as the ImageData's byte
// array: every draw call below writes one pixel as one packed 32-bit store
// instead of 4 separate byte stores (r/g/b/a), which is what actually moves the
// needle on textured floor/ceiling rendering — see writeShadedSpan.
let frameBuffer: { width: number; height: number; imageData: ImageData; buf32: Uint32Array } | null = null;

function getFrameBuffer(width: number, height: number): { imageData: ImageData; buf32: Uint32Array } {
  if (!frameBuffer || frameBuffer.width !== width || frameBuffer.height !== height) {
    const imageData = new ImageData(width, height);
    const buf32 = new Uint32Array(imageData.data.buffer);
    frameBuffer = { width, height, imageData, buf32 };
  }
  return frameBuffer;
}

// Per-column "nearest opaque distance" (wall or riser, whichever is closer), populated
// during the main column loop in renderFrame and consumed by renderBillboards to occlude
// sprites behind solid geometry. Same single-scalar-per-column zbuffer approach every
// classic grid raycaster uses for sprites — it can't account for a farther riser sitting
// in a screen gap above/below a nearer one in the same column, but that's the same class
// of simplification this engine already accepts for single-hit-per-column walls (see
// README's known limitations).
let depthBuffer: Float32Array | null = null;

function getDepthBuffer(width: number): Float32Array {
  if (!depthBuffer || depthBuffer.length !== width) depthBuffer = new Float32Array(width);
  return depthBuffer;
}

// Packs r/g/b (each assumed already an int in [0, 255]) plus opaque alpha into one
// little-endian uint32 — byte 0 (r) is the least-significant byte in memory, matching
// how Uint8ClampedArray lays out [r,g,b,a] per pixel. All draw calls here only ever
// produce clamped 0-255 components (fog/sideMul multipliers are already in [0,1]
// applied to 0-255 source colors), so there's nothing left for Uint8ClampedArray's
// own clamping to do — safe to bypass it entirely by writing the packed word directly.
function packRgb(r: number, g: number, b: number): number {
  return (r | (g << 8) | (b << 16) | 0xff000000) >>> 0;
}

interface DepthLayer {
  dist: number;
  kind: 0 | 1;
  i: number;
  // last step index covered by this layer, for kind 0 — see mergeFloorRun in renderFrame.
  // Equal to `i` for kind 1 (risers are never merged, only single-step).
  iEnd: number;
}

// Depth-sorted layers used to be a fresh array of fresh objects per column (see
// renderFrame) — every column, every frame allocated up to ~2x maxSteps small
// objects just to sort and immediately discard them. This pool is grown lazily
// and its entries mutated in place instead, since a column never needs more
// layers than the previous largest column has already sized the pool for.
const layerPool: DepthLayer[] = [];

function ensureLayerPool(minSize: number): void {
  while (layerPool.length < minSize) layerPool.push({ dist: 0, kind: 0, i: 0, iEnd: 0 });
}

// Tracks which screen rows in the current column have already been painted by a nearer
// layer, so farther layers can skip repainting them instead of drawing full-height and
// relying on a later layer to overwrite — that painter's-algorithm approach meant every
// layer (the far wall fill *and* every floor/ceiling segment *and* every riser) rasterized
// its entire span regardless of what already covered it, and up close, where spans grow
// large, that turns into multiple full-column redraws stacked on top of each other. Both
// arrays are index-parallel, sorted and merged (no overlaps), reused across columns.
let coveredStart: number[] = [];
let coveredEnd: number[] = [];
let coveredCount = 0;

function ensureCoveredPool(minSize: number): void {
  while (coveredStart.length < minSize) {
    coveredStart.push(0);
    coveredEnd.push(0);
  }
}

function resetCovered(): void {
  coveredCount = 0;
}

// Inserts [s, e) into the covered set, merging it with any existing interval it
// overlaps or touches so the set stays minimal and sorted by start.
function insertCovered(s: number, e: number): void {
  ensureCoveredPool(coveredCount + 1);
  let mergedStart = s;
  let mergedEnd = e;
  let writeIdx = 0;
  for (let i = 0; i < coveredCount; i++) {
    const cs = coveredStart[i];
    const ce = coveredEnd[i];
    if (ce < mergedStart || cs > mergedEnd) {
      coveredStart[writeIdx] = cs;
      coveredEnd[writeIdx] = ce;
      writeIdx++;
    } else {
      mergedStart = Math.min(mergedStart, cs);
      mergedEnd = Math.max(mergedEnd, ce);
    }
  }
  let insertAt = writeIdx;
  for (let i = 0; i < writeIdx; i++) {
    if (coveredStart[i] > mergedStart) {
      insertAt = i;
      break;
    }
  }
  for (let i = writeIdx; i > insertAt; i--) {
    coveredStart[i] = coveredStart[i - 1];
    coveredEnd[i] = coveredEnd[i - 1];
  }
  coveredStart[insertAt] = mergedStart;
  coveredEnd[insertAt] = mergedEnd;
  coveredCount = writeIdx + 1;
}

// Visible (uncovered) sub-ranges of the last computeGaps() call — read via gapStart/gapEnd/
// gapCount right after calling it. A return value here would mean allocating a fresh result
// array on every call (this runs several times per column, every column, every frame).
let gapStart: number[] = [];
let gapEnd: number[] = [];
let gapCount = 0;

function ensureGapPool(minSize: number): void {
  while (gapStart.length < minSize) {
    gapStart.push(0);
    gapEnd.push(0);
  }
}

// Splits [s, e) against the covered set, writing whatever parts of it aren't already
// covered into gapStart/gapEnd/gapCount, then marks all of [s, e) as covered — even the
// parts that were already covered (by a nearer layer) or newly drawn (by this one) are,
// either way, no longer available for anything farther processed after this call.
function computeGaps(s: number, e: number): void {
  gapCount = 0;
  if (e <= s) return;
  let cursor = s;
  for (let i = 0; i < coveredCount && cursor < e; i++) {
    const cs = coveredStart[i];
    const ce = coveredEnd[i];
    if (ce <= cursor || cs >= e) continue;
    if (cs > cursor) {
      ensureGapPool(gapCount + 1);
      gapStart[gapCount] = cursor;
      gapEnd[gapCount] = Math.min(cs, e);
      gapCount++;
    }
    cursor = Math.max(cursor, ce);
  }
  if (cursor < e) {
    ensureGapPool(gapCount + 1);
    gapStart[gapCount] = cursor;
    gapEnd[gapCount] = e;
    gapCount++;
  }
  insertCovered(s, e);
}

// Writes a shaded vertical span directly into the pixel buffer — shading and the
// buffer write used to be two steps (shade() returning a fresh [r,g,b] tuple, then
// writeColumnSpan consuming it), which meant one small array allocation per texel
// row: up to 64 wall rows + up to 64 plane bands per layer, times every column,
// times every frame. Folding shading into the write eliminates that tuple entirely.
// Every column in a frame used to also be built from dozens of ctx.fillRect calls,
// each paying for a fillStyle CSS-string parse and the canvas state machine — with
// hundreds of columns and up to ~140 spans each, that's tens of thousands of canvas
// calls per frame. Writing bytes straight into an ImageData buffer and blitting it
// once via putImageData (see renderFrame) is what actually removes the lag.
function writeShadedSpan(
  buf32: Uint32Array,
  bufWidth: number,
  screenHeight: number,
  col: number,
  yTop: number,
  yBottom: number,
  hex: string,
  sideMul: number,
  dist: number,
): void {
  const top = Math.round(Math.max(0, Math.min(screenHeight, yTop)));
  const bottom = Math.round(Math.max(0, Math.min(screenHeight, yBottom)));
  if (bottom <= top) return;
  const rgb = hexToRgb(hex);
  // floors near 0 (not 1) so geometry fades to black by MAX_RENDER_DIST instead of
  // sitting at a visible dim floor right up to the DDA cutoff, which used to make
  // distant walls pop into view abruptly as the render-distance cap passed over them
  const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
  const m = sideMul * fog;
  const pixel = packRgb((rgb[0] * m) | 0, (rgb[1] * m) | 0, (rgb[2] * m) | 0);
  for (let y = top; y < bottom; y++) {
    buf32[y * bufWidth + col] = pixel;
  }
}

// Flat RGB expansion of a texture's hex pixels, 3 bytes/texel — lets the wall-column and
// plane-segment hot paths index a texel's color with two array reads instead of a
// string-keyed hexToRgb(Map) lookup. That lookup used to run once per texel *row* for walls
// (up to TEXTURE_SIZE times per column) and once per *band* for floors/ceilings (up to one
// per screen row, per segment, times every segment in the column) — with hundreds of
// columns and several segments up close, that's hundreds of thousands of Map.get(string)
// calls a frame, which is exactly why textured surfaces cost far more than flat-colored ones
// even though both eventually resolve to the same handful of on-screen colors. Buffers are
// pooled per TextureDef (reused across frames to avoid GC churn) and only re-expanded when
// stamped stale, so a texture is walked pixel-by-pixel at most once per frame regardless of
// how many columns/bands sample it.
let textureFrameStamp = 0;
const textureRgbBuffers = new WeakMap<TextureDef, Uint8ClampedArray>();
const textureRgbStamps = new WeakMap<TextureDef, number>();

function getTextureRgb(texture: TextureDef): Uint8ClampedArray {
  let buf = textureRgbBuffers.get(texture);
  if (!buf) {
    buf = new Uint8ClampedArray(TEXTURE_SIZE * TEXTURE_SIZE * 3);
    textureRgbBuffers.set(texture, buf);
  }
  if (textureRgbStamps.get(texture) !== textureFrameStamp) {
    const { pixels } = texture;
    for (let i = 0; i < pixels.length; i++) {
      const rgb = hexToRgb(pixels[i] ?? "#000000");
      const o = i * 3;
      buf[o] = rgb[0];
      buf[o + 1] = rgb[1];
      buf[o + 2] = rgb[2];
    }
    textureRgbStamps.set(texture, textureFrameStamp);
  }
  return buf;
}

// Reusable per-band packed pixel for renderPlaneSegment, grown lazily to whatever band
// count a segment needs (bounded by screen height in practice — see renderPlaneSegment) —
// same one-store-per-pixel packing as texRowPixel below.
let bandPixel: number[] = [];

function ensureBandPool(minSize: number): void {
  while (bandPixel.length < minSize) bandPixel.push(0xff000000);
}

// A textured wall column used to be drawn as up to TEXTURE_SIZE (64) separate
// writeShadedSpan calls, one per texel row — each paying its own Math.round/clamp pair
// and its own hexToRgb cache lookup, on top of the actual pixel writes. A flat-colored
// wall only ever needs 1 such call, which is exactly why a plain wall filling the screen
// stayed fast while a textured one filling the screen dropped to a fraction of the
// framerate: the 64x call overhead, not the pixel-writing itself, was the cost. Since a
// wall column samples a single fixed texture column (texX doesn't vary by row — only
// texY does), the whole row->RGB mapping can be computed once up front and then walked
// with a single tight per-pixel loop per visible gap, no per-row rounding or lookups left
// in the hot path.
// Reusable per-texel-row packed pixel, sized to TEXTURE_SIZE and reused across columns —
// replaces texRowR/G/B (see writeTexturedWallColumn): packing once per row up front means
// the per-pixel write loop below does a single uint32 store instead of unpacking 3 separate
// component arrays per pixel.
const texRowPixel: number[] = new Array(TEXTURE_SIZE).fill(0xff000000);

function writeTexturedWallColumn(
  buf32: Uint32Array,
  bufWidth: number,
  screenHeight: number,
  col: number,
  texture: TextureDef,
  texX: number,
  top: number,
  bottom: number,
  sideMul: number,
  dist: number,
  visStart: number[],
  visEnd: number[],
  visCount: number,
): void {
  const span = bottom - top;
  if (span <= 0) return;
  const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
  const m = sideMul * fog;
  const rgbBuf = getTextureRgb(texture);
  for (let row = 0; row < TEXTURE_SIZE; row++) {
    const o = (row * TEXTURE_SIZE + texX) * 3;
    texRowPixel[row] = packRgb((rgbBuf[o] * m) | 0, (rgbBuf[o + 1] * m) | 0, (rgbBuf[o + 2] * m) | 0);
  }
  const rowStep = TEXTURE_SIZE / span;
  for (let g = 0; g < visCount; g++) {
    const gs = Math.round(Math.max(0, Math.min(screenHeight, visStart[g])));
    const ge = Math.round(Math.max(0, Math.min(screenHeight, visEnd[g])));
    if (ge <= gs) continue;
    let rowF = (gs - top) * rowStep;
    for (let y = gs; y < ge; y++) {
      let row = rowF | 0;
      if (row < 0) row = 0;
      else if (row >= TEXTURE_SIZE) row = TEXTURE_SIZE - 1;
      buf32[y * bufWidth + col] = texRowPixel[row];
      rowF += rowStep;
    }
  }
}

// Plain (non-closure) projection helpers — renderFrame used to define projY/riserProjY
// as inline closures capturing eyeY/centerY/scale, which allocates a fresh function
// object per column (projY) and per riser layer (riserProjY). Passing the captured
// values as explicit args instead lets the same top-level function be reused everywhere.
function projectY(worldY: number, eyeY: number, centerY: number, scale: number): number {
  return centerY - (worldY - eyeY) * scale;
}

function planeProjY(worldY: number, dist: number, eyeY: number, centerY: number, screenHeight: number): number {
  return centerY - (worldY - eyeY) * (screenHeight / Math.max(dist, 0.0001));
}

/** Inverse of planeProjY: recovers the ray distance at which a plane fixed at worldY
 * crosses screen row y. Used to walk from screen space back to world space per texel row. */
function planeDistAt(worldY: number, y: number, eyeY: number, centerY: number, screenHeight: number): number {
  const denom = centerY - y;
  if (Math.abs(denom) < 0.0001) return MAX_RENDER_DIST;
  const d = ((worldY - eyeY) * screenHeight) / denom;
  return Math.min(MAX_RENDER_DIST, Math.max(0.0001, Math.abs(d)));
}

/** Floor/ceiling texturing for one grid-cell segment of one column: buckets the segment's
 * screen span into rows and, for each row, recovers the world point under it to sample the
 * 2D tile at (x mod 1, y mod 1). Band count scales with the segment's on-screen height (up to
 * MAX_PLANE_BANDS) rather than a flat TEXTURE_SIZE — perspective can stretch the near segment
 * (right under the camera) across 100+ screen rows, and sampling that with too few bands turns
 * it into a few giant flat-colored slabs that visibly swim as the camera moves. Distant segments
 * are naturally short on screen, so they still get resolved with far fewer bands than that cap.
 * renderFrame's floor-run coalescing means a long, open, uniform sightline is now one wide
 * segment instead of dozens of narrow ones (see the coalescing comment there) — MAX_PLANE_BANDS
 * is what keeps that single wide segment's sampling cost bounded, same as it always bounded the
 * near segment under the player (which is large on-screen regardless of coalescing). */
// top/bottom are the segment's full clamped screen range (already computed by the caller,
// via planeProjY, to decide occlusion before calling in — see renderFrame); clipTop/clipBottom
// are the uncovered sub-range within it that's actually still visible and should be painted.
function renderPlaneSegment(
  buf32: Uint32Array,
  bufWidth: number,
  map: MapData,
  col: number,
  ref: string | null,
  worldY: number,
  top: number,
  bottom: number,
  segNear: number,
  segFar: number,
  camera: Camera,
  rayDirX: number,
  rayDirY: number,
  eyeY: number,
  centerY: number,
  screenHeight: number,
  fallback: string,
  clipTop: number,
  clipBottom: number,
): void {
  const parsed = parseTextureRef(ref);
  const texture = parsed?.kind === "texture" ? textureIndexFor(map).get(parsed.id) : undefined;

  // band count tracks the segment's actual pixel span (capped at MAX_PLANE_BANDS) instead of
  // a flat TEXTURE_SIZE floor — a distant, on-screen-tiny segment forced through a fixed
  // count would mostly collapse to duplicate rounded rows, wasting time on a segment that
  // barely registers on screen
  const span = bottom - top;
  const bands = Math.min(MAX_PLANE_BANDS, Math.max(1, Math.ceil(span)));
  ensureBandPool(bands);

  // Every band still needs its own fog value even for a flat color — the world distance
  // under a floor/ceiling row changes across the segment, and run-coalescing (see renderFrame)
  // now regularly hands this a single wide segment spanning a whole open sightline. Fogging
  // it with one span-averaged distance (the old shortcut here) made a merged colored run
  // render as one uniform-brightness slab that never fades into the distance — looked like
  // a flat plane stretching to infinity instead of receding. Texture sampling (u/v/texX/texY)
  // is the only per-band cost a flat color can skip.
  const rgbBuf = texture ? getTextureRgb(texture) : null;
  const flatRgb = rgbBuf ? null : hexToRgb(refColor(ref, fallback));
  for (let band = 0; band < bands; band++) {
    const rowTop = top + (band / bands) * span;
    const rowBottom = top + ((band + 1) / bands) * span;
    const midY = (rowTop + rowBottom) / 2;
    const dist = planeDistAt(worldY, midY, eyeY, centerY, screenHeight);
    const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
    if (rgbBuf) {
      const fx = camera.x + dist * rayDirX;
      const fy = camera.y + dist * rayDirY;
      const u = fx - Math.floor(fx);
      const v = fy - Math.floor(fy);
      const texX = Math.min(TEXTURE_SIZE - 1, Math.max(0, Math.floor(u * TEXTURE_SIZE)));
      const texY = Math.min(TEXTURE_SIZE - 1, Math.max(0, Math.floor(v * TEXTURE_SIZE)));
      const o = (texY * TEXTURE_SIZE + texX) * 3;
      bandPixel[band] = packRgb((rgbBuf[o] * fog) | 0, (rgbBuf[o + 1] * fog) | 0, (rgbBuf[o + 2] * fog) | 0);
    } else {
      const rgb = flatRgb!;
      bandPixel[band] = packRgb((rgb[0] * fog) | 0, (rgb[1] * fog) | 0, (rgb[2] * fog) | 0);
    }
  }

  const writeTop = Math.round(Math.max(0, Math.min(screenHeight, clipTop)));
  const writeBottom = Math.round(Math.max(0, Math.min(screenHeight, clipBottom)));
  if (writeBottom <= writeTop) return;
  const bandStep = bands / span;
  let bandF = (writeTop - top) * bandStep;
  for (let y = writeTop; y < writeBottom; y++) {
    let band = bandF | 0;
    if (band < 0) band = 0;
    else if (band >= bands) band = bands - 1;
    buf32[y * bufWidth + col] = bandPixel[band];
    bandF += bandStep;
  }
}

const DOOR_BORDER_MARGIN = 0.12;
const KEY_MARKER_RADIUS = 0.22;

/** Thin colored ring around the floor of a formerly-locked, now-open door cell —
 * the only visible trace once the wall itself is gone, so the player can still tell
 * "a door used to be here." Painted as a second pass over the same gaps the floor was
 * just drawn into (see renderFrame's floor block), so it inherits that occlusion for
 * free instead of needing its own covered-set bookkeeping. */
function paintDoorBorder(
  buf32: Uint32Array,
  bufWidth: number,
  screenHeight: number,
  col: number,
  worldY: number,
  camera: Camera,
  rayDirX: number,
  rayDirY: number,
  eyeY: number,
  centerY: number,
  hex: string,
  clipTop: number,
  clipBottom: number,
): void {
  const top = Math.round(Math.max(0, Math.min(screenHeight, clipTop)));
  const bottom = Math.round(Math.max(0, Math.min(screenHeight, clipBottom)));
  if (bottom <= top) return;
  const rgb = hexToRgb(hex);
  for (let y = top; y < bottom; y++) {
    const dist = planeDistAt(worldY, y, eyeY, centerY, screenHeight);
    const fx = camera.x + dist * rayDirX;
    const fy = camera.y + dist * rayDirY;
    const u = fx - Math.floor(fx);
    const v = fy - Math.floor(fy);
    if (u > DOOR_BORDER_MARGIN && u < 1 - DOOR_BORDER_MARGIN && v > DOOR_BORDER_MARGIN && v < 1 - DOOR_BORDER_MARGIN) {
      continue;
    }
    const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
    buf32[y * bufWidth + col] = packRgb((rgb[0] * fog) | 0, (rgb[1] * fog) | 0, (rgb[2] * fog) | 0);
  }
}

/** Solid colored patch in the middle of an uncollected key pickup's cell floor — the
 * simplest possible marker given the runtime has no sprite/billboard renderer yet
 * (that's the Enemies roadmap item's job, not this one). Same second-pass-over-the-
 * gaps technique as paintDoorBorder. */
function paintKeyMarker(
  buf32: Uint32Array,
  bufWidth: number,
  screenHeight: number,
  col: number,
  worldY: number,
  camera: Camera,
  rayDirX: number,
  rayDirY: number,
  eyeY: number,
  centerY: number,
  hex: string,
  clipTop: number,
  clipBottom: number,
): void {
  const top = Math.round(Math.max(0, Math.min(screenHeight, clipTop)));
  const bottom = Math.round(Math.max(0, Math.min(screenHeight, clipBottom)));
  if (bottom <= top) return;
  const rgb = hexToRgb(hex);
  for (let y = top; y < bottom; y++) {
    const dist = planeDistAt(worldY, y, eyeY, centerY, screenHeight);
    const fx = camera.x + dist * rayDirX;
    const fy = camera.y + dist * rayDirY;
    const u = fx - Math.floor(fx) - 0.5;
    const v = fy - Math.floor(fy) - 0.5;
    if (u * u + v * v > KEY_MARKER_RADIUS * KEY_MARKER_RADIUS) continue;
    const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
    buf32[y * bufWidth + col] = packRgb((rgb[0] * fog) | 0, (rgb[1] * fog) | 0, (rgb[2] * fog) | 0);
  }
}

const WEAPON_PICKUP_COLOR_HEX = "#e67e22";
const WEAPON_MARKER_HALF_SIZE = 0.22;

/** Small square patch on an uncollected weapon pickup's cell floor, same technique and
 * intent as paintKeyMarker (no sprite/billboard renderer yet — see that comment above). */
function paintWeaponMarker(
  buf32: Uint32Array,
  bufWidth: number,
  screenHeight: number,
  col: number,
  worldY: number,
  camera: Camera,
  rayDirX: number,
  rayDirY: number,
  eyeY: number,
  centerY: number,
  clipTop: number,
  clipBottom: number,
): void {
  const top = Math.round(Math.max(0, Math.min(screenHeight, clipTop)));
  const bottom = Math.round(Math.max(0, Math.min(screenHeight, clipBottom)));
  if (bottom <= top) return;
  const rgb = hexToRgb(WEAPON_PICKUP_COLOR_HEX);
  for (let y = top; y < bottom; y++) {
    const dist = planeDistAt(worldY, y, eyeY, centerY, screenHeight);
    const fx = camera.x + dist * rayDirX;
    const fy = camera.y + dist * rayDirY;
    const u = fx - Math.floor(fx) - 0.5;
    const v = fy - Math.floor(fy) - 0.5;
    if (Math.abs(u) > WEAPON_MARKER_HALF_SIZE || Math.abs(v) > WEAPON_MARKER_HALF_SIZE) continue;
    const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
    buf32[y * bufWidth + col] = packRgb((rgb[0] * fog) | 0, (rgb[1] * fog) | 0, (rgb[2] * fog) | 0);
  }
}

const EXIT_MARKER_INNER = 0.14;
const EXIT_MARKER_OUTER = 0.24;

/** Colored ring on the exit cell's floor — always visible (unlike key markers, which
 * disappear once collected), and a ring rather than paintKeyMarker's solid dot so it
 * reads as a distinct "goal" rather than another pickup. Same technique as the other
 * floor decals. */
function paintExitMarker(
  buf32: Uint32Array,
  bufWidth: number,
  screenHeight: number,
  col: number,
  worldY: number,
  camera: Camera,
  rayDirX: number,
  rayDirY: number,
  eyeY: number,
  centerY: number,
  hex: string,
  clipTop: number,
  clipBottom: number,
): void {
  const top = Math.round(Math.max(0, Math.min(screenHeight, clipTop)));
  const bottom = Math.round(Math.max(0, Math.min(screenHeight, clipBottom)));
  if (bottom <= top) return;
  const rgb = hexToRgb(hex);
  for (let y = top; y < bottom; y++) {
    const dist = planeDistAt(worldY, y, eyeY, centerY, screenHeight);
    const fx = camera.x + dist * rayDirX;
    const fy = camera.y + dist * rayDirY;
    const u = fx - Math.floor(fx) - 0.5;
    const v = fy - Math.floor(fy) - 0.5;
    const d2 = u * u + v * v;
    if (d2 < EXIT_MARKER_INNER * EXIT_MARKER_INNER || d2 > EXIT_MARKER_OUTER * EXIT_MARKER_OUTER) continue;
    const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
    buf32[y * bufWidth + col] = packRgb((rgb[0] * fog) | 0, (rgb[1] * fog) | 0, (rgb[2] * fog) | 0);
  }
}

/** True if this cell needs its own individually-rendered floor segment (door border, exit
 * ring, or an uncollected pickup) rather than being merged into a neighboring run of plain
 * floor — see mergeFloorRun below. Cheap coordinate/set lookups only, no rendering. */
function cellHasFloorDecal(
  map: MapData,
  cell: Cell | null,
  exitCellX: number,
  exitCellY: number,
  heldKeys: ReadonlySet<KeyColor>,
  collectedWeaponIds: ReadonlySet<string>,
): boolean {
  if (!cell) return false;
  if (cell.doorColor && cell.doorOpen) return true;
  if (cell.x === exitCellX && cell.y === exitCellY) return true;
  const pickup = keyPickupIndexFor(map).get(`${cell.x},${cell.y}`);
  if (pickup && !heldKeys.has(pickup.color)) return true;
  const weaponPickup = weaponPickupIndexFor(map).get(`${cell.x},${cell.y}`);
  if (weaponPickup && !collectedWeaponIds.has(weaponPickup.weaponId)) return true;
  return false;
}

// Sprites are never behind the camera plane at exactly zero depth, but near-zero depth
// blows up spriteScreenX (division by transformY) into nonsense off-screen coordinates —
// clip anything closer than this instead of letting it flicker through the projection.
const SPRITE_NEAR_CLIP = 0.1;

/** One column-stripe of a billboard: samples texture column texX across [yTop, yBottom],
 * skipping transparent (null) texels one row at a time — unlike writeTexturedWallColumn's
 * opaque fast path, a billboard's silhouette isn't a filled rectangle, so this can't
 * precompute one packed pixel per row and blit blindly. Billboard counts are small (a
 * handful of enemies on screen, not one call per screen column), so this doesn't need
 * that path's row-precompute/pooling — a per-texel hexToRgb call is already cache-hit. */
function writeBillboardColumn(
  buf32: Uint32Array,
  bufWidth: number,
  screenHeight: number,
  col: number,
  texture: TextureDef,
  texX: number,
  yTop: number,
  yBottom: number,
  dist: number,
  tintRgb: [number, number, number] | null,
  tintStrength: number,
): void {
  const span = yBottom - yTop;
  if (span <= 0) return;
  const top = Math.max(0, Math.floor(yTop));
  const bottom = Math.min(screenHeight, Math.ceil(yBottom));
  if (bottom <= top) return;
  const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
  const rowStep = TEXTURE_SIZE / span;
  for (let y = top; y < bottom; y++) {
    let row = ((y - yTop) * rowStep) | 0;
    if (row < 0) row = 0;
    else if (row >= TEXTURE_SIZE) row = TEXTURE_SIZE - 1;
    const hex = texture.pixels[row * TEXTURE_SIZE + texX];
    if (hex === null) continue;
    const rgb = hexToRgb(hex);
    let r = rgb[0];
    let g = rgb[1];
    let b = rgb[2];
    if (tintRgb) {
      r += (tintRgb[0] - r) * tintStrength;
      g += (tintRgb[1] - g) * tintStrength;
      b += (tintRgb[2] - b) * tintStrength;
    }
    buf32[y * bufWidth + col] = packRgb((r * fog) | 0, (g * fog) | 0, (b * fog) | 0);
  }
}

interface SpriteProjection {
  billboard: Billboard;
  dist: number;
  screenX: number;
}

/** Sprite-casting pass, run once per frame after all column geometry is in buf32/depthBuffer
 * (see renderFrame). Transforms each billboard into camera space with the standard
 * inverse-camera-matrix formula (same convention as castColumn's rayDir construction, so
 * the two projections agree pixel-for-pixel), sorts far-to-near, then draws each as a
 * vertical strip per covered column, skipping columns depthBuffer already marked as
 * blocked by nearer wall/riser geometry. Sprite-vs-sprite overlap is handled by the
 * far-to-near draw order alone (nearer sprites simply overwrite farther ones) — no need to
 * update depthBuffer per sprite since only static geometry needs to occlude billboards. */
function renderBillboards(
  buf32: Uint32Array,
  bufWidth: number,
  screenHeight: number,
  map: MapData,
  camera: Camera,
  fwdX: number,
  fwdY: number,
  planeX: number,
  planeY: number,
  eyeY: number,
  centerY: number,
  depths: Float32Array,
  billboards: Billboard[],
): void {
  if (billboards.length === 0) return;

  const invDet = 1 / (planeX * fwdY - fwdX * planeY);
  const projections: SpriteProjection[] = [];
  for (const billboard of billboards) {
    const dx = billboard.x - camera.x;
    const dy = billboard.y - camera.y;
    const transformX = invDet * (fwdY * dx - fwdX * dy);
    const dist = invDet * (-planeY * dx + planeX * dy);
    if (dist <= SPRITE_NEAR_CLIP) continue;
    const screenX = (bufWidth / 2) * (1 + transformX / dist);
    projections.push({ billboard, dist, screenX });
  }
  projections.sort((a, b) => b.dist - a.dist);

  for (const proj of projections) {
    const { billboard, dist, screenX } = proj;
    const parsed = parseTextureRef(billboard.textureRef);
    if (!parsed) continue;

    const scale = screenHeight / dist;
    const halfWidthPx = (scale * billboard.worldWidth) / 2;
    if (halfWidthPx <= 0) continue;
    const leftPx = screenX - halfWidthPx;
    const drawStart = Math.max(0, Math.floor(leftPx));
    const drawEnd = Math.min(bufWidth - 1, Math.floor(screenX + halfWidthPx));
    if (drawEnd < drawStart) continue;

    const cellFloorY = floorHeightAt(map, billboard.x, billboard.y) * HEIGHT_STEP;
    const yTop = projectY(cellFloorY + billboard.worldHeight, eyeY, centerY, scale);
    const yBottom = projectY(cellFloorY, eyeY, centerY, scale);

    const tintRgb = billboard.tint ? hexToRgb(billboard.tint.color) : null;
    const tintStrength = billboard.tint?.strength ?? 0;

    if (parsed.kind === "color") {
      let [r, g, b] = hexToRgb(parsed.color);
      if (tintRgb) {
        r += (tintRgb[0] - r) * tintStrength;
        g += (tintRgb[1] - g) * tintStrength;
        b += (tintRgb[2] - b) * tintStrength;
      }
      const fog = Math.max(0, 1 - dist / MAX_RENDER_DIST);
      const pixel = packRgb((r * fog) | 0, (g * fog) | 0, (b * fog) | 0);
      const top = Math.max(0, Math.round(yTop));
      const bottom = Math.min(screenHeight, Math.round(yBottom));
      if (bottom <= top) continue;
      for (let col = drawStart; col <= drawEnd; col++) {
        if (dist >= depths[col]) continue;
        for (let y = top; y < bottom; y++) buf32[y * bufWidth + col] = pixel;
      }
      continue;
    }

    const texture = textureIndexFor(map).get(parsed.id);
    if (!texture) continue;
    const widthPx = halfWidthPx * 2;
    for (let col = drawStart; col <= drawEnd; col++) {
      if (dist >= depths[col]) continue;
      let texX = Math.floor(((col - leftPx) / widthPx) * TEXTURE_SIZE);
      if (texX < 0) texX = 0;
      else if (texX >= TEXTURE_SIZE) texX = TEXTURE_SIZE - 1;
      writeBillboardColumn(buf32, bufWidth, screenHeight, col, texture, texX, yTop, yBottom, dist, tintRgb, tintStrength);
    }
  }
}

/** Grid raycaster with stepped heightfields: walls are single-hit-per-column
 * (no overhangs/second stories, see README known limitations), but floor
 * height transitions between wall hits render as step risers. */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  map: MapData,
  camera: Camera,
  width: number,
  height: number,
  heldKeys: ReadonlySet<KeyColor> = new Set(),
  collectedWeaponIds: ReadonlySet<string> = new Set(),
  billboards: Billboard[] = [],
): void {
  textureFrameStamp++;
  const centerY = height / 2;
  const eyeY = floorHeightAt(map, camera.x, camera.y) * HEIGHT_STEP + EYE_OFFSET;
  const exitCellX = Math.floor(map.exit.x);
  const exitCellY = Math.floor(map.exit.y);

  const fwdX = Math.cos(camera.angle);
  const fwdY = Math.sin(camera.angle);
  const planeLen = Math.tan(camera.fov / 2);
  const planeX = -fwdY * planeLen;
  const planeY = fwdX * planeLen;

  const { imageData, buf32 } = getFrameBuffer(width, height);
  const depths = getDepthBuffer(width);

  for (let col = 0; col < width; col++) {
    const cameraX = (2 * col) / width - 1;
    const rayDirX = fwdX + planeX * cameraX;
    const rayDirY = fwdY + planeY * cameraX;
    const { steps, hitDist, wallCell, side } = castColumn(map, camera, rayDirX, rayDirY);

    const corrected = Math.max(hitDist, 0.0001);
    const scale = height / corrected;
    // nearest opaque distance for this column — starts at the wall, tightened below to
    // whichever riser (if any) sits closer than it; feeds depthBuffer for sprite occlusion
    let colOpaqueDist = corrected;

    const baseFloorHeight = steps[steps.length - 1].height;
    const sideMul = side === 1 ? 0.75 : 1;
    // unclamped — kept exactly as projected so an up-close wall's texture overflows the
    // screen and gets cropped at the edges (see the row-bounds comment below), instead of
    // the whole texture visibly squeezing into view
    const wallTop = projectY(CEILING_Y, eyeY, centerY, scale);
    const wallBottom = projectY(baseFloorHeight * HEIGHT_STEP, eyeY, centerY, scale);
    // texture row-mapping reference: always the wall's true ceiling-to-ground extent, even
    // when a height 1/2 platform in front of it occludes the lower part (raising wallBottom
    // above true ground). Using wallBottom for both clipping *and* row-mapping would scale
    // the whole texture into whatever sliver remains above the platform instead of showing
    // just its top portion at the same texel density as an unoccluded wall.
    const wallTextureBottom = projectY(0, eyeY, centerY, scale);

    resetCovered();

    ensureLayerPool(steps.length * 2);
    let layerCount = 0;
    // Coalesces consecutive steps into one floor/ceiling layer when they'd render
    // identically anyway (same height, same floor+ceiling texture, no door/exit/pickup
    // to draw) — a long unobstructed sightline over open floor otherwise racks up one
    // DDA-grid-crossing per step (see castColumn), each paying its own computeGaps call
    // and renderPlaneSegment band loop for what is visually a single flat surface. Runs
    // break at any decal-bearing cell so door borders/exit rings/pickups still render
    // individually and exactly where they are.
    let i = 0;
    while (i < steps.length) {
      const cell = steps[i].cell;
      let j = i;
      if (!cellHasFloorDecal(map, cell, exitCellX, exitCellY, heldKeys, collectedWeaponIds)) {
        while (
          j + 1 < steps.length &&
          steps[j + 1].height === steps[i].height &&
          (steps[j + 1].cell?.floorTextureId ?? null) === (cell?.floorTextureId ?? null) &&
          (steps[j + 1].cell?.ceilingTextureId ?? null) === (cell?.ceilingTextureId ?? null) &&
          !cellHasFloorDecal(map, steps[j + 1].cell, exitCellX, exitCellY, heldKeys, collectedWeaponIds)
        ) {
          j++;
        }
      }
      const segFar = j + 1 < steps.length ? steps[j + 1].dist : hitDist;
      if (segFar > steps[i].dist) {
        const layer = layerPool[layerCount++];
        layer.dist = steps[i].dist;
        layer.kind = 0;
        layer.i = i;
        layer.iEnd = j;
      }
      i = j + 1;
    }
    for (let i = steps.length - 1; i > 0; i--) {
      // only a riser as a step rising in front of the viewer (far > near) — with no camera
      // pitch there's no "looking down over the ledge" view to render for the opposite
      // (descending) case
      if (steps[i].height <= steps[i - 1].height) continue;
      const layer = layerPool[layerCount++];
      layer.dist = Math.max(steps[i].dist, 0.0001);
      layer.kind = 1;
      layer.i = i;
      layer.iEnd = i;
      colOpaqueDist = Math.min(colOpaqueDist, layer.dist);
    }
    depths[col] = colOpaqueDist;
    // farthest-to-nearest so a nearer surface always wins the rows it shares with a farther one.
    // Insertion sort over the pooled range (layerCount is small — a handful of steps per
    // column) instead of Array.prototype.sort, which would need a plain-array copy of the
    // pool slice first since sort() can't be bounded to a sub-range of a shared array.
    for (let i = 1; i < layerCount; i++) {
      const dist = layerPool[i].dist;
      const kind = layerPool[i].kind;
      const idx = layerPool[i].i;
      const idxEnd = layerPool[i].iEnd;
      let j = i - 1;
      while (j >= 0 && layerPool[j].dist < dist) {
        layerPool[j + 1].dist = layerPool[j].dist;
        layerPool[j + 1].kind = layerPool[j].kind;
        layerPool[j + 1].i = layerPool[j].i;
        layerPool[j + 1].iEnd = layerPool[j].iEnd;
        j--;
      }
      layerPool[j + 1].dist = dist;
      layerPool[j + 1].kind = kind;
      layerPool[j + 1].i = idx;
      layerPool[j + 1].iEnd = idxEnd;
    }

    // Nearest-to-farthest (reverse of the farthest-to-nearest sort above): each layer is
    // checked against what a nearer layer already claimed via computeGaps, and only paints
    // the leftover gaps — instead of everything painting full-height farthest-to-nearest and
    // relying on later (nearer) draws to overwrite earlier ones, which meant every layer,
    // including the far wall below, rasterized its *entire* span regardless of what would
    // end up covering it. That's the fix for the FPS drop up close: near layers project to
    // much larger spans, so the redundant work this used to do scaled up sharply with them.
    for (let k = layerCount - 1; k >= 0; k--) {
      const layer = layerPool[k];
      const i = layer.i;
      if (layer.kind === 0) {
        const segNear = steps[i].dist;
        const segFar = layer.iEnd + 1 < steps.length ? steps[layer.iEnd + 1].dist : hitDist;
        const cell = steps[i].cell;

        const floorWorldY = steps[i].height * HEIGHT_STEP;
        const fA = planeProjY(floorWorldY, segNear, eyeY, centerY, height);
        const fB = planeProjY(floorWorldY, segFar, eyeY, centerY, height);
        const floorTop = Math.max(0, Math.min(fA, fB));
        const floorBottom = Math.min(height, Math.max(fA, fB));
        if (floorBottom > floorTop) {
          computeGaps(floorTop, floorBottom);
          for (let g = 0; g < gapCount; g++) {
            renderPlaneSegment(
              buf32, width, map, col, cell?.floorTextureId ?? null, floorWorldY, floorTop, floorBottom,
              segNear, segFar, camera, rayDirX, rayDirY, eyeY, centerY, height, "#333333",
              gapStart[g], gapEnd[g],
            );
          }
          // reuses the same gapStart/gapEnd/gapCount from the floor's own computeGaps call above
          // (still valid — nothing has touched the shared globals since), so these decals
          // automatically respect whatever occlusion the floor draw already resolved
          if (cell?.doorColor && cell.doorOpen) {
            const hex = KEY_COLOR_HEX[cell.doorColor];
            for (let g = 0; g < gapCount; g++) {
              paintDoorBorder(buf32, width, height, col, floorWorldY, camera, rayDirX, rayDirY, eyeY, centerY, hex, gapStart[g], gapEnd[g]);
            }
          } else if (cell && cell.x === exitCellX && cell.y === exitCellY) {
            for (let g = 0; g < gapCount; g++) {
              paintExitMarker(buf32, width, height, col, floorWorldY, camera, rayDirX, rayDirY, eyeY, centerY, EXIT_COLOR_HEX, gapStart[g], gapEnd[g]);
            }
          } else if (cell) {
            const pickup = keyPickupIndexFor(map).get(`${cell.x},${cell.y}`);
            const weaponPickup = weaponPickupIndexFor(map).get(`${cell.x},${cell.y}`);
            if (pickup && !heldKeys.has(pickup.color)) {
              const hex = KEY_COLOR_HEX[pickup.color];
              for (let g = 0; g < gapCount; g++) {
                paintKeyMarker(buf32, width, height, col, floorWorldY, camera, rayDirX, rayDirY, eyeY, centerY, hex, gapStart[g], gapEnd[g]);
              }
            } else if (weaponPickup && !collectedWeaponIds.has(weaponPickup.weaponId)) {
              for (let g = 0; g < gapCount; g++) {
                paintWeaponMarker(buf32, width, height, col, floorWorldY, camera, rayDirX, rayDirY, eyeY, centerY, gapStart[g], gapEnd[g]);
              }
            }
          }
        }

        const cA = planeProjY(CEILING_Y, segNear, eyeY, centerY, height);
        const cB = planeProjY(CEILING_Y, segFar, eyeY, centerY, height);
        const ceilTop = Math.max(0, Math.min(cA, cB));
        const ceilBottom = Math.min(height, Math.max(cA, cB));
        if (ceilBottom > ceilTop) {
          computeGaps(ceilTop, ceilBottom);
          for (let g = 0; g < gapCount; g++) {
            renderPlaneSegment(
              buf32, width, map, col, cell?.ceilingTextureId ?? null, CEILING_Y, ceilTop, ceilBottom,
              segNear, segFar, camera, rayDirX, rayDirY, eyeY, centerY, height, "#1a1a1a",
              gapStart[g], gapEnd[g],
            );
          }
        }
      } else {
        const near = steps[i - 1].height;
        const far = steps[i].height;
        const riserDist = layer.dist;
        const riserScale = height / riserDist;
        const rA = projectY(far * HEIGHT_STEP, eyeY, centerY, riserScale);
        const rB = projectY(near * HEIGHT_STEP, eyeY, centerY, riserScale);
        const riserTop = Math.max(0, Math.min(rA, rB));
        const riserBottom = Math.min(height, Math.max(rA, rB));
        if (riserBottom > riserTop) {
          computeGaps(riserTop, riserBottom);
          const riserFloorRef = steps[i].cell?.floorTextureId ?? null;
          const riserParsed = parseTextureRef(riserFloorRef);
          const riserTexture = riserParsed?.kind === "texture" ? textureIndexFor(map).get(riserParsed.id) : undefined;
          if (riserTexture) {
            const riserSide = steps[i].side;
            let riserU = riserSide === 0 ? camera.y + riserDist * rayDirY : camera.x + riserDist * rayDirX;
            riserU -= Math.floor(riserU);
            if (riserSide === 0 && rayDirX > 0) riserU = 1 - riserU;
            if (riserSide === 1 && rayDirY < 0) riserU = 1 - riserU;
            const riserTexX = Math.min(TEXTURE_SIZE - 1, Math.max(0, Math.floor(riserU * TEXTURE_SIZE)));
            writeTexturedWallColumn(
              buf32, width, height, col, riserTexture, riserTexX, rA, rB, 0.85, riserDist,
              gapStart, gapEnd, gapCount,
            );
          } else {
            for (let g = 0; g < gapCount; g++) {
              writeShadedSpan(buf32, width, height, col, gapStart[g], gapEnd[g], "#999999", 0.85, riserDist);
            }
          }
        }
      }
    }

    // The wall is always the single farthest thing in the column (hitDist >= every step's
    // dist by construction — see castColumn), so it's painted last, filling in only whatever
    // no nearer layer already claimed.
    const wallClampTop = Math.max(0, Math.min(wallTop, wallBottom));
    const wallClampBottom = Math.min(height, Math.max(wallTop, wallBottom));
    if (wallClampBottom > wallClampTop) {
      const wallRef =
        wallCell?.doorColor && !wallCell.doorOpen
          ? `color:${KEY_COLOR_HEX[wallCell.doorColor]}`
          : (wallCell?.wallTextureId ?? null);
      const parsed = parseTextureRef(wallRef);
      const texture = parsed?.kind === "texture" ? textureIndexFor(map).get(parsed.id) : undefined;

      if (texture) {
        // rayDir isn't unit length here, so the hit point isn't camera + rayDir*hitDist —
        // this form (distance projected back through the ray's own component) is the
        // standard way to recover it when hitDist is a perpendicular (not Euclidean) distance
        let wallU = side === 0 ? camera.y + hitDist * rayDirY : camera.x + hitDist * rayDirX;
        wallU -= Math.floor(wallU);
        if (side === 0 && rayDirX > 0) wallU = 1 - wallU;
        if (side === 1 && rayDirY < 0) wallU = 1 - wallU;
        const texX = Math.min(TEXTURE_SIZE - 1, Math.max(0, Math.floor(wallU * TEXTURE_SIZE)));

        computeGaps(wallClampTop, wallClampBottom);
        writeTexturedWallColumn(
          buf32, width, height, col, texture, texX, wallTop, wallTextureBottom, sideMul, corrected,
          gapStart, gapEnd, gapCount,
        );
      } else {
        computeGaps(wallClampTop, wallClampBottom);
        for (let g = 0; g < gapCount; g++) {
          writeShadedSpan(buf32, width, height, col, gapStart[g], gapEnd[g], refColor(wallRef, "#888888"), sideMul, corrected);
        }
      }
    }
  }

  renderBillboards(buf32, width, height, map, camera, fwdX, fwdY, planeX, planeY, eyeY, centerY, depths, billboards);

  ctx.putImageData(imageData, 0, 0);
}
