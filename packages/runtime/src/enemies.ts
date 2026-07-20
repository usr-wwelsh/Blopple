import type { EnemyBehavior, MapData } from "@blopple/shared";
import { isSolid, raycastWallDistance, type Billboard } from "./engine";
import { damagePlayer, type PlayerState } from "./player";
import type { Projectile } from "./combat";

const HIT_FLASH_MS = 150;
const HIT_FLASH_COLOR = "#ff2020";
// how far inside its attack range a "ranged" enemy lets the player get before backing off
const RANGED_RETREAT_FRACTION = 0.5;

/** Per-placement runtime state resolved from map.enemies + map.enemyDefs. */
export interface EnemyInstance {
  enemyId: string;
  x: number;
  y: number;
  currentHealth: number;
  isDead: boolean;
  width: number;
  height: number;
  spriteRef: string | null;
  /** counts down from HIT_FLASH_MS after a hit — drives the red pulse in enemyBillboards */
  hitFlashMs: number;
  behavior: EnemyBehavior;
  speed: number;
  damage: number;
  attackRangeCells: number;
  attackRateMs: number;
  detectionRangeCells: number;
  /** only meaningful when behavior === "stationary" */
  projectileSpeed: number | null;
  projectileSpriteRef: string | null;
  /** counts down from attackRateMs after landing an attack, mirrors PlayerState.fireCooldownMs */
  attackCooldownMs: number;
}

export function createEnemyInstances(map: MapData): EnemyInstance[] {
  return map.enemies.flatMap((placement) => {
    const def = map.enemyDefs.find((e) => e.id === placement.enemyId);
    if (!def) return [];
    return [
      {
        enemyId: placement.enemyId,
        x: placement.x,
        y: placement.y,
        currentHealth: def.health,
        isDead: false,
        width: def.width,
        height: def.height,
        spriteRef: def.spriteRef,
        hitFlashMs: 0,
        behavior: def.behavior,
        speed: def.speed,
        damage: def.damage,
        attackRangeCells: def.attackRangeCells,
        attackRateMs: def.attackRateMs,
        detectionRangeCells: def.detectionRangeCells,
        projectileSpeed: def.projectileSpeed,
        projectileSpriteRef: def.projectileSpriteRef,
        attackCooldownMs: 0,
      },
    ];
  });
}

/** Per-axis clamped slide against walls, same shape as player.ts's tryMove but with
 * no door-unlock side effect — enemies don't carry keys. */
function tryMoveEnemy(map: MapData, x: number, y: number, dx: number, dy: number, radius: number): { x: number; y: number } {
  let nx = x;
  let ny = y;
  if (dx !== 0) {
    const testX = x + dx;
    const edge = dx > 0 ? radius : -radius;
    if (!isSolid(map, testX + edge, y)) nx = testX;
  }
  if (dy !== 0) {
    const testY = y + dy;
    const edge = dy > 0 ? radius : -radius;
    if (!isSolid(map, nx, testY + edge)) ny = testY;
  }
  return { x: nx, y: ny };
}

/** An enemy only reacts once the player is within detectionRangeCells AND in line of
 * sight (checked via the same raycastWallDistance helper combat.ts uses for hitscan) —
 * hide behind a wall and it stays idle even if you're close. Once aware, behavior
 * branches: "chase" closes distance and melee-attacks in range; "stationary" never
 * moves and fires a projectile (via combat.ts's updateProjectiles) at anything that
 * wanders into range (turret/sentry); "ranged" holds/melee-attacks from range and backs
 * off if the player closes inside RANGED_RETREAT_FRACTION of that range (kiting). No
 * pathfinding in any case: an enemy on the wrong side of a wall just stops advancing
 * (or retreating) until line of sight opens up. */
export function updateEnemyAI(
  enemies: EnemyInstance[],
  map: MapData,
  player: PlayerState,
  projectiles: Projectile[],
  dt: number,
): void {
  if (player.isDead || player.hasReachedExit) return;

  for (const enemy of enemies) {
    if (enemy.isDead) continue;
    if (enemy.attackCooldownMs > 0) enemy.attackCooldownMs = Math.max(0, enemy.attackCooldownMs - dt * 1000);

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= 0 || dist > enemy.detectionRangeCells) continue;

    const dirX = dx / dist;
    const dirY = dy / dist;
    const hasLineOfSight = raycastWallDistance(map, enemy.x, enemy.y, dirX, dirY, dist) >= dist;
    if (!hasLineOfSight) continue;

    const inAttackRange = dist <= enemy.attackRangeCells;
    if (inAttackRange && enemy.attackCooldownMs <= 0) {
      if (enemy.behavior === "stationary") {
        projectiles.push({
          x: enemy.x,
          y: enemy.y,
          dirX,
          dirY,
          speed: enemy.projectileSpeed ?? 0,
          remainingRange: enemy.attackRangeCells,
          damage: enemy.damage,
          spriteRef: enemy.projectileSpriteRef,
          source: "enemy",
        });
      } else {
        damagePlayer(player, enemy.damage);
      }
      enemy.attackCooldownMs = enemy.attackRateMs;
    }

    if (enemy.behavior === "stationary") continue;

    let moveDirX = dirX;
    let moveDirY = dirY;
    let step = 0;
    if (enemy.behavior === "ranged" && dist < enemy.attackRangeCells * RANGED_RETREAT_FRACTION) {
      moveDirX = -dirX;
      moveDirY = -dirY;
      step = enemy.speed * dt;
    } else if (!inAttackRange) {
      step = Math.min(enemy.speed * dt, dist - enemy.attackRangeCells);
    }

    if (step > 0) {
      const moved = tryMoveEnemy(map, enemy.x, enemy.y, moveDirX * step, moveDirY * step, enemy.width / 2);
      enemy.x = moved.x;
      enemy.y = moved.y;
    }
  }
}

/** Mirrors player.ts's damagePlayer: clamp at 0, flip isDead, no-op once dead. */
export function damageEnemy(instance: EnemyInstance, amount: number): void {
  if (instance.isDead) return;
  instance.currentHealth = Math.max(0, instance.currentHealth - amount);
  instance.hitFlashMs = HIT_FLASH_MS;
  if (instance.currentHealth <= 0) instance.isDead = true;
}

/** Decays the hit-flash timer, same pattern as player.ts's viewmodelFlashMs. */
export function updateEnemies(enemies: EnemyInstance[], dt: number): void {
  for (const enemy of enemies) {
    if (enemy.hitFlashMs > 0) enemy.hitFlashMs = Math.max(0, enemy.hitFlashMs - dt * 1000);
  }
}

/** Resolves the alive subset to billboards each frame — a dead enemy just drops out of
 * the render list next frame instead of needing a separate removal step. Recently-hit
 * enemies get a red tint that fades out over HIT_FLASH_MS. */
export function enemyBillboards(enemies: EnemyInstance[]): Billboard[] {
  return enemies
    .filter((e) => !e.isDead)
    .map((e) => ({
      x: e.x,
      y: e.y,
      textureRef: e.spriteRef,
      worldWidth: e.width,
      worldHeight: e.height,
      tint: e.hitFlashMs > 0 ? { color: HIT_FLASH_COLOR, strength: e.hitFlashMs / HIT_FLASH_MS } : null,
    }));
}
