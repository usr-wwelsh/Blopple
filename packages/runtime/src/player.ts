import type { KeyColor, MapData, PlayerDef } from "@blopple/shared";
import { cellAt, isSolid } from "./engine";
import type { InputState } from "./input";

const PLAYER_RADIUS = 0.2;
const KEY_PICKUP_RADIUS = 0.5;
const WEAPON_PICKUP_RADIUS = 0.5;
const EXIT_RADIUS = 0.5;
const MAX_HELD_WEAPONS = 4;
const MAX_VIEWMODEL_FLASH_MS = 150;

export interface PlayerState {
  x: number;
  y: number;
  angle: number;
  keys: Set<KeyColor>;
  hasReachedExit: boolean;
  /** weapon ids collected, in pickup order — index doubles as the HUD/switch slot number */
  heldWeaponIds: string[];
  /** index into heldWeaponIds, -1 if nothing held */
  equippedIndex: number;
  fireCooldownMs: number;
  /** >0 while the viewmodel should show the fire pose instead of idle */
  viewmodelFlashMs: number;
  /** true only on the exact frame a shot was fired — callers use this to trigger the fire sfx */
  justFired: boolean;
}

export function createPlayerState(map: MapData): PlayerState {
  const heldWeaponIds = map.player.startingWeaponId ? [map.player.startingWeaponId] : [];
  return {
    x: map.playerStart.x,
    y: map.playerStart.y,
    angle: map.playerStart.facing,
    keys: new Set(),
    hasReachedExit: false,
    heldWeaponIds,
    equippedIndex: heldWeaponIds.length > 0 ? 0 : -1,
    fireCooldownMs: 0,
    viewmodelFlashMs: 0,
    justFired: false,
  };
}

/** Permanently opens a locked door at (x, y) if it matches a key the player holds —
 * "bump to open," no separate use/interact key. Mutates the cell in place, same as
 * every other cell mutation in this codebase (see engine.ts's cellIndexCache comment). */
function tryUnlockDoor(map: MapData, keys: ReadonlySet<KeyColor>, x: number, y: number): void {
  const cell = cellAt(map, x, y);
  if (cell && cell.doorColor && !cell.doorOpen && keys.has(cell.doorColor)) {
    cell.doorOpen = true;
  }
}

/** move each axis separately, clamped at the leading edge so the player slides along walls */
function tryMove(
  map: MapData,
  keys: ReadonlySet<KeyColor>,
  x: number,
  y: number,
  dx: number,
  dy: number,
): { x: number; y: number } {
  let nx = x;
  let ny = y;
  if (dx !== 0) {
    const testX = x + dx;
    const edge = dx > 0 ? PLAYER_RADIUS : -PLAYER_RADIUS;
    tryUnlockDoor(map, keys, testX + edge, y);
    if (!isSolid(map, testX + edge, y)) nx = testX;
  }
  if (dy !== 0) {
    const testY = y + dy;
    const edge = dy > 0 ? PLAYER_RADIUS : -PLAYER_RADIUS;
    tryUnlockDoor(map, keys, nx, testY + edge);
    if (!isSolid(map, nx, testY + edge)) ny = testY;
  }
  return { x: nx, y: ny };
}

export function updatePlayer(state: PlayerState, map: MapData, player: PlayerDef, input: InputState, dt: number): void {
  state.justFired = false;
  if (state.hasReachedExit) return;

  state.fireCooldownMs = Math.max(0, state.fireCooldownMs - dt * 1000);
  state.viewmodelFlashMs = Math.max(0, state.viewmodelFlashMs - dt * 1000);

  if (input.switchToSlot !== null && state.heldWeaponIds[input.switchToSlot - 1]) {
    state.equippedIndex = input.switchToSlot - 1;
  }

  state.angle += input.turnRate * dt + input.lookDelta;

  const dirX = Math.cos(state.angle);
  const dirY = Math.sin(state.angle);
  const strafeX = Math.cos(state.angle + Math.PI / 2);
  const strafeY = Math.sin(state.angle + Math.PI / 2);

  const speed = player.speed * dt;
  const dx = (dirX * input.forward + strafeX * input.strafe) * speed;
  const dy = (dirY * input.forward + strafeY * input.strafe) * speed;

  const moved = tryMove(map, state.keys, state.x, state.y, dx, dy);
  state.x = moved.x;
  state.y = moved.y;

  for (const pickup of map.keyPickups) {
    if (state.keys.has(pickup.color)) continue;
    const pdx = pickup.x - state.x;
    const pdy = pickup.y - state.y;
    if (pdx * pdx + pdy * pdy <= KEY_PICKUP_RADIUS * KEY_PICKUP_RADIUS) state.keys.add(pickup.color);
  }

  if (state.heldWeaponIds.length < MAX_HELD_WEAPONS) {
    for (const pickup of map.weaponPickups) {
      if (state.heldWeaponIds.includes(pickup.weaponId)) continue;
      const pdx = pickup.x - state.x;
      const pdy = pickup.y - state.y;
      if (pdx * pdx + pdy * pdy > WEAPON_PICKUP_RADIUS * WEAPON_PICKUP_RADIUS) continue;
      const hadNone = state.heldWeaponIds.length === 0;
      state.heldWeaponIds.push(pickup.weaponId);
      if (hadNone) state.equippedIndex = 0;
      if (state.heldWeaponIds.length >= MAX_HELD_WEAPONS) break;
    }
  }

  const equippedWeaponId = state.equippedIndex >= 0 ? state.heldWeaponIds[state.equippedIndex] : undefined;
  const equippedWeapon = equippedWeaponId ? map.weapons.find((w) => w.id === equippedWeaponId) : undefined;
  if (input.fire && equippedWeapon && state.fireCooldownMs <= 0) {
    state.fireCooldownMs = equippedWeapon.fireRateMs;
    state.viewmodelFlashMs = Math.min(MAX_VIEWMODEL_FLASH_MS, equippedWeapon.fireRateMs);
    state.justFired = true;
  }

  const edx = map.exit.x - state.x;
  const edy = map.exit.y - state.y;
  if (edx * edx + edy * edy <= EXIT_RADIUS * EXIT_RADIUS) state.hasReachedExit = true;
}
