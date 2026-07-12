import type { MapData } from "@blopple/shared";

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

/** Doom-style bottom status bar, drawn on top of the already-rendered 3D frame.
 * Trimmed to what the schema actually tracks right now (health, one equippable
 * weapon) — no ammo/armor sections since there's no pickup/inventory system yet. */
export function renderHud(ctx: CanvasRenderingContext2D, map: MapData, width: number, height: number): void {
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
  ctx.fillText(`${Math.max(0, Math.round(map.player.health))}%`, pad, barTop + numberSize + pad * 0.3);

  ctx.fillStyle = LABEL_COLOR;
  ctx.font = `${labelSize}px monospace`;
  ctx.fillText("HEALTH", pad, barTop + barHeight - pad * 0.5);

  // weapon slots
  const slotSize = Math.round(barHeight * 0.6);
  const slotGap = Math.round(slotSize * 0.25);
  const slotsWidth = WEAPON_SLOT_COUNT * slotSize + (WEAPON_SLOT_COUNT - 1) * slotGap;
  let slotX = width - pad - slotsWidth;
  const slotY = barTop + (barHeight - slotSize) / 2;
  const equippedSlot = map.player.startingWeaponId ? 1 : 0;

  ctx.textAlign = "center";
  for (let i = 1; i <= WEAPON_SLOT_COUNT; i++) {
    const active = i === equippedSlot;
    ctx.strokeStyle = active ? SLOT_ACTIVE_BORDER : SLOT_DIM_BORDER;
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
}
