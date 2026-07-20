import type { MapData } from "@blopple/shared";
import { renderFrame, type Camera } from "./engine";
import { renderHud, renderViewmodel, renderExitOverlay, renderDeathOverlay } from "./hud";
import { InputController } from "./input";
import { createPlayerState, updatePlayer } from "./player";
import { createEnemyInstances, updateEnemies, enemyBillboards } from "./enemies";
import { fireWeapon, updateProjectiles, projectileBillboards, type Projectile } from "./combat";
import { playSfx, playMusic } from "./audio";

// injected by the export step as a <script> before this bundle
declare const BLOPPLE_MAP: MapData;

document.body.style.margin = "0";
document.body.style.background = "#000";

const canvas = document.createElement("canvas");
canvas.width = 640;
canvas.height = 400;
document.body.appendChild(canvas);
const ctx = canvas.getContext("2d")!;

const player = createPlayerState(BLOPPLE_MAP);
const enemies = createEnemyInstances(BLOPPLE_MAP);
const projectiles: Projectile[] = [];
const input = new InputController(canvas);
input.start();

const camera: Camera = { x: player.x, y: player.y, angle: player.angle, fov: Math.PI / 3 };

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  updatePlayer(player, BLOPPLE_MAP, BLOPPLE_MAP.player, input.poll(), dt);
  camera.x = player.x;
  camera.y = player.y;
  camera.angle = player.angle;

  if (player.justFired) {
    const weapon = BLOPPLE_MAP.weapons.find((w) => w.id === player.heldWeaponIds[player.equippedIndex]);
    if (weapon) fireWeapon(BLOPPLE_MAP, player, weapon, enemies, projectiles);
    playSfx(BLOPPLE_MAP, weapon?.sfxId ?? null);
  }
  updateProjectiles(BLOPPLE_MAP, projectiles, enemies, dt);
  updateEnemies(enemies, dt);
  playMusic(BLOPPLE_MAP, player.hasReachedExit ? BLOPPLE_MAP.music.outroSongId : BLOPPLE_MAP.music.gameplaySongId);

  const billboards = [...enemyBillboards(enemies), ...projectileBillboards(projectiles)];
  renderFrame(ctx, BLOPPLE_MAP, camera, canvas.width, canvas.height, player.keys, new Set(player.heldWeaponIds), billboards);
  renderViewmodel(ctx, BLOPPLE_MAP, player, canvas.width, canvas.height);
  renderHud(ctx, player, canvas.width, canvas.height);
  if (player.hasReachedExit) renderExitOverlay(ctx, BLOPPLE_MAP, canvas.width, canvas.height);
  else if (player.isDead) renderDeathOverlay(ctx, canvas.width, canvas.height);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
