import type { MapData, PlayerDef } from "@blopple/shared";
import { isSolid } from "./engine";
import type { InputState } from "./input";

const PLAYER_RADIUS = 0.2;

export interface PlayerState {
  x: number;
  y: number;
  angle: number;
}

export function createPlayerState(map: MapData): PlayerState {
  return { x: map.playerStart.x, y: map.playerStart.y, angle: map.playerStart.facing };
}

/** move each axis separately, clamped at the leading edge so the player slides along walls */
function tryMove(map: MapData, x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  let nx = x;
  let ny = y;
  if (dx !== 0) {
    const testX = x + dx;
    const edge = dx > 0 ? PLAYER_RADIUS : -PLAYER_RADIUS;
    if (!isSolid(map, testX + edge, y)) nx = testX;
  }
  if (dy !== 0) {
    const testY = y + dy;
    const edge = dy > 0 ? PLAYER_RADIUS : -PLAYER_RADIUS;
    if (!isSolid(map, nx, testY + edge)) ny = testY;
  }
  return { x: nx, y: ny };
}

export function updatePlayer(state: PlayerState, map: MapData, player: PlayerDef, input: InputState, dt: number): void {
  state.angle += input.turnRate * dt + input.lookDelta;

  const dirX = Math.cos(state.angle);
  const dirY = Math.sin(state.angle);
  const strafeX = Math.cos(state.angle + Math.PI / 2);
  const strafeY = Math.sin(state.angle + Math.PI / 2);

  const speed = player.speed * dt;
  const dx = (dirX * input.forward + strafeX * input.strafe) * speed;
  const dy = (dirY * input.forward + strafeY * input.strafe) * speed;

  const moved = tryMove(map, state.x, state.y, dx, dy);
  state.x = moved.x;
  state.y = moved.y;
}
