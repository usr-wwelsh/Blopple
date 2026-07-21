import type { MapData } from "@blopple/shared";
import { KEY_COLORS, KEY_COLOR_HEX, parseTextureRef } from "@blopple/shared";
import type { PlayerState } from "./player";
import { textureCanvasFor } from "./textureCanvas";

const BAR_HEIGHT_RATIO = 0.14;
const WEAPON_SLOT_COUNT = 4;

const BAR_BG = "#3a3a3a";
const BAR_BORDER = "#1a1a1a";
const HEALTH_COLOR = "#c41e1e";
const LABEL_COLOR = "#999999";
const SLOT_ACTIVE_BORDER = "#e8b923";
const SLOT_ACTIVE_TEXT = "#e8e8e8";
const SLOT_DIM_BORDER = "#555555";
const SLOT_DIM_TEXT = "#555555";
const KEY_SLOT_DIM_BORDER = "#4a4a4a";

/** Doom-style bottom status bar, drawn on top of the already-rendered 3D frame.
 * Trimmed to what the schema actually tracks right now (health, up to 4 held
 * weapons, held keys) — no ammo/armor sections since there's no ammo tracking yet. */
export function renderHud(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  width: number,
  height: number,
): void {
  const heldKeys = player.keys;
  const barHeight = Math.round(height * BAR_HEIGHT_RATIO);
  const barTop = height - barHeight;
  const pad = Math.round(barHeight * 0.12);
  const labelSize = Math.max(8, Math.round(barHeight * 0.18));

  ctx.fillStyle = BAR_BORDER;
  ctx.fillRect(0, barTop - 2, width, 2);
  ctx.fillStyle = BAR_BG;
  ctx.fillRect(0, barTop, width, barHeight);

  // health
  const numberSize = Math.max(10, Math.round(barHeight * 0.5));
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = HEALTH_COLOR;
  ctx.font = `bold ${numberSize}px monospace`;
  ctx.fillText(`${Math.max(0, Math.round(player.currentHealth))}%`, pad, barTop + numberSize + pad * 0.3);

  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `${labelSize}px monospace`;
  ctx.fillText("HEALTH", pad, barTop + barHeight - pad * 0.5);

  // weapon slots
  const slotSize = Math.round(barHeight * 0.6);
  const slotGap = Math.round(slotSize * 0.25);
  const slotsWidth = WEAPON_SLOT_COUNT * slotSize + (WEAPON_SLOT_COUNT - 1) * slotGap;
  const weaponSlotsLeft = width - pad - slotsWidth;
  let slotX = weaponSlotsLeft;
  const slotY = barTop + (barHeight - slotSize) / 2;

  ctx.textAlign = "center";
  for (let i = 1; i <= WEAPON_SLOT_COUNT; i++) {
    const filled = player.heldWeaponIds[i - 1] !== undefined;
    const active = filled && player.equippedIndex === i - 1;
    ctx.strokeStyle = active ? SLOT_ACTIVE_BORDER : filled ? SLOT_DIM_TEXT : SLOT_DIM_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(slotX, slotY, slotSize, slotSize);
    ctx.fillStyle = active ? SLOT_ACTIVE_TEXT : SLOT_DIM_TEXT;
    ctx.font = `bold ${Math.max(10, Math.round(slotSize * 0.55))}px monospace`;
    ctx.fillText(String(i), slotX + slotSize / 2, slotY + slotSize * 0.7);
    slotX += slotSize + slotGap;
  }

  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `${labelSize}px monospace`;
  ctx.textAlign = "right";
  ctx.fillText("WEAPON", width - pad, barTop + barHeight - pad * 0.5);

  // key slots — one small swatch per color, filled once held, sat just left of the weapon slots
  const keySize = Math.round(barHeight * 0.4);
  const keyGap = Math.round(keySize * 0.3);
  const keysWidth = KEY_COLORS.length * keySize + (KEY_COLORS.length - 1) * keyGap;
  const keyY = barTop + (barHeight - keySize) / 2;
  let keyX = weaponSlotsLeft - slotGap * 2 - keysWidth;

  for (const color of KEY_COLORS) {
    const held = heldKeys.has(color);
    ctx.fillStyle = held ? KEY_COLOR_HEX[color] : BAR_BG;
    ctx.fillRect(keyX, keyY, keySize, keySize);
    ctx.strokeStyle = held ? KEY_COLOR_HEX[color] : KEY_SLOT_DIM_BORDER;
    ctx.lineWidth = 2;
    ctx.strokeRect(keyX, keyY, keySize, keySize);
    keyX += keySize + keyGap;
  }

  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `${labelSize}px monospace`;
  ctx.textAlign = "right";
  ctx.fillText("KEYS", weaponSlotsLeft - slotGap * 2, barTop + barHeight - pad * 0.5);
}

const VIEWMODEL_SIZE_RATIO = 0.4;
const VIEWMODEL_BOTTOM_MARGIN_RATIO = 0.02;

/** Bottom-center first-person weapon sprite — swaps to the fire frame while
 * player.viewmodelFlashMs is still counting down (see updatePlayer). No animation beyond
 * that single idle/fire swap (see WeaponSpriteFrames — static frames by design). */
export function renderViewmodel(ctx: CanvasRenderingContext2D, map: MapData, player: PlayerState, width: number, height: number): void {
  const weaponId = player.equippedIndex >= 0 ? player.heldWeaponIds[player.equippedIndex] : undefined;
  const weapon = weaponId ? map.weapons.find((w) => w.id === weaponId) : undefined;
  if (!weapon) return;

  const ref = player.viewmodelFlashMs > 0 ? (weapon.sprites.fire ?? weapon.sprites.idle) : weapon.sprites.idle;
  const parsed = parseTextureRef(ref);
  if (!parsed) return;

  const size = Math.round(height * VIEWMODEL_SIZE_RATIO);
  const x = Math.round((width - size) / 2);
  const y = Math.round(height - size - height * VIEWMODEL_BOTTOM_MARGIN_RATIO);

  if (parsed.kind === "color") {
    ctx.fillStyle = parsed.color;
    ctx.fillRect(x, y, size, size);
    return;
  }

  const texture = map.textures.find((t) => t.id === parsed.id);
  if (!texture) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(textureCanvasFor(texture), x, y, size, size);
}

const OVERLAY_BG = "rgba(0, 0, 0, 0.75)";
const OVERLAY_TEXT = "#e8e8e8";

function renderOverlay(ctx: CanvasRenderingContext2D, message: string, width: number, height: number): void {
  ctx.fillStyle = OVERLAY_BG;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = OVERLAY_TEXT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${Math.round(height * 0.08)}px monospace`;
  ctx.fillText(message, width / 2, height / 2);
}

const HINT_COLOR = "#999999";
const HINT_TEXT = "PRESS ANY KEY TO RESPAWN";
const HINT_DIM_ALPHA = 0.35;
const HINT_BLINK_MS = 1000;
const HINT_BLINK_ON_MS = 650;

/** How long input is locked out after death before "any key" actually respawns —
 * shared with the keydown/mousedown handlers in main.ts / PlayTest.svelte so the hint's
 * fade-in and the real unlock happen at the same instant. */
export const RESPAWN_LOCK_MS = 3000;

/** Full-screen overlay shown once currentHealth hits 0 — freezes on top of whatever frame
 * was last rendered (movement is already frozen in updatePlayer via isDead). The respawn
 * hint stays dim and static during RESPAWN_LOCK_MS, then lights up and blinks once the
 * caller's "any key" handler will actually respond to input. */
export function renderDeathOverlay(ctx: CanvasRenderingContext2D, width: number, height: number, elapsedMs: number): void {
  renderOverlay(ctx, "YOU DIED", width, height);

  const locked = elapsedMs < RESPAWN_LOCK_MS;
  if (!locked && elapsedMs % HINT_BLINK_MS >= HINT_BLINK_ON_MS) return;

  ctx.save();
  ctx.globalAlpha = locked ? HINT_DIM_ALPHA : 1;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = HINT_COLOR;
  ctx.font = `${Math.round(height * 0.035)}px monospace`;
  ctx.fillText(HINT_TEXT, width / 2, height / 2 + height * 0.12);
  ctx.restore();
}
