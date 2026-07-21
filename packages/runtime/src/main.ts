import type { MapData } from "@blopple/shared";
import { renderFrame, type Camera } from "./engine";
import { renderHud, renderViewmodel, renderDeathOverlay, RESPAWN_LOCK_MS } from "./hud";
import { renderIntroOutroScreen } from "./introOutro";
import { InputController } from "./input";
import { createPlayerState, updatePlayer } from "./player";
import { createEnemyInstances, updateEnemies, updateEnemyAI, enemyBillboards } from "./enemies";
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

// title screen (waiting for input) -> gameplay -> level-complete screen, in that order —
// see IntroOutroConfig for what each of the two non-gameplay screens can show.
// "dead" is a side branch off "playing", reachable on death and looping back to "playing".
type Phase = "intro" | "playing" | "outro" | "dead";
let phase: Phase = "intro";
let phaseStartMs = performance.now();

function beginPlaying(): void {
  if (phase !== "intro") return;
  phase = "playing";
  phaseStartMs = performance.now();
}

function respawn(): void {
  if (phase !== "dead" || performance.now() - phaseStartMs < RESPAWN_LOCK_MS) return;
  Object.assign(player, createPlayerState(BLOPPLE_MAP));
  enemies.length = 0;
  enemies.push(...createEnemyInstances(BLOPPLE_MAP));
  projectiles.length = 0;
  phase = "playing";
  phaseStartMs = performance.now();
}
window.addEventListener("keydown", () => {
  beginPlaying();
  respawn();
});
canvas.addEventListener("mousedown", () => {
  beginPlaying();
  respawn();
});

let last = performance.now();
function loop(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;

  if (phase === "intro") {
    playMusic(BLOPPLE_MAP, BLOPPLE_MAP.intro.musicId);
    renderIntroOutroScreen(ctx, BLOPPLE_MAP, BLOPPLE_MAP.intro, now - phaseStartMs, canvas.width, canvas.height, "PRESS ANY KEY TO START");
    requestAnimationFrame(loop);
    return;
  }

  if (phase === "outro") {
    playMusic(BLOPPLE_MAP, BLOPPLE_MAP.outro.musicId);
    renderIntroOutroScreen(ctx, BLOPPLE_MAP, BLOPPLE_MAP.outro, now - phaseStartMs, canvas.width, canvas.height, null);
    requestAnimationFrame(loop);
    return;
  }

  if (phase === "dead") {
    const billboards = enemyBillboards(enemies);
    for (const b of projectileBillboards(projectiles)) billboards.push(b);
    renderFrame(ctx, BLOPPLE_MAP, camera, canvas.width, canvas.height, player.keys, new Set(player.heldWeaponIds), billboards);
    renderViewmodel(ctx, BLOPPLE_MAP, player, canvas.width, canvas.height);
    renderHud(ctx, player, canvas.width, canvas.height);
    renderDeathOverlay(ctx, canvas.width, canvas.height, now - phaseStartMs);
    requestAnimationFrame(loop);
    return;
  }

  updatePlayer(player, BLOPPLE_MAP, BLOPPLE_MAP.player, input.poll(), dt);
  camera.x = player.x;
  camera.y = player.y;
  camera.angle = player.angle;

  if (player.justFired) {
    const weapon = BLOPPLE_MAP.weapons.find((w) => w.id === player.heldWeaponIds[player.equippedIndex]);
    if (weapon) fireWeapon(BLOPPLE_MAP, player, weapon, enemies, projectiles);
    playSfx(BLOPPLE_MAP, weapon?.sfxId ?? null);
  }
  updateProjectiles(BLOPPLE_MAP, projectiles, enemies, player, dt);
  updateEnemyAI(enemies, BLOPPLE_MAP, player, projectiles, dt);
  updateEnemies(enemies, dt);
  playMusic(BLOPPLE_MAP, BLOPPLE_MAP.music.gameplaySongId);

  const billboards = enemyBillboards(enemies);
  for (const b of projectileBillboards(projectiles)) billboards.push(b);
  renderFrame(ctx, BLOPPLE_MAP, camera, canvas.width, canvas.height, player.keys, new Set(player.heldWeaponIds), billboards);
  renderViewmodel(ctx, BLOPPLE_MAP, player, canvas.width, canvas.height);
  renderHud(ctx, player, canvas.width, canvas.height);

  if (player.isDead) {
    phase = "dead";
    phaseStartMs = now;
  } else if (player.hasReachedExit) {
    phase = "outro";
    phaseStartMs = now;
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
