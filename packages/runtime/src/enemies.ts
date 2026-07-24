import type { EnemyBehavior, MapData } from "@blopple/shared";
import { isSolid, raycastWallDistance, type Billboard } from "./engine";
import { damagePlayer, type PlayerState } from "./player";
import type { Projectile } from "./combat";
import { findPath } from "./pathfinding";

const HIT_FLASH_MS = 150;
const HIT_FLASH_COLOR = "#ff2020";
/** How often a pathing enemy recomputes its route to the player — frequent enough to
 * react to the player moving, cheap enough for several enemies to path in the same
 * frame batch. */
const PATH_RECOMPUTE_MS = 500;
/** Waypoint reached once within this distance — small relative to a cell so the enemy
 * doesn't orbit the point, generous enough that speed*dt overshoot on a slow frame still
 * counts as arrival. */
const WAYPOINT_EPSILON = 0.15;

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
  /** queued cell-center waypoints to the player, used when line of sight is blocked;
   * null when idle/in direct pursuit. See findPath in pathfinding.ts. */
  path: { x: number; y: number }[] | null;
  /** counts down to the next path recompute; only ticks while a path is in use */
  pathRecomputeMs: number;
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
        path: null,
        pathRecomputeMs: 0,
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

/** Drives movement for an enemy that can't see the player directly: follows (and
 * periodically refreshes) an A* route toward the player's current cell, advancing
 * through waypoints one at a time. Leaves enemy.x/y untouched if no path exists (e.g.
 * the player's cell is unreachable) — same end result as the old no-LOS behavior of
 * standing still, just retried every PATH_RECOMPUTE_MS instead of every frame. */
function moveAlongPath(enemy: EnemyInstance, map: MapData, player: PlayerState, dt: number): void {
  enemy.pathRecomputeMs -= dt * 1000;
  if (!enemy.path || enemy.path.length === 0 || enemy.pathRecomputeMs <= 0) {
    enemy.path = findPath(map, enemy.x, enemy.y, player.x, player.y);
    enemy.pathRecomputeMs = PATH_RECOMPUTE_MS;
  }
  if (!enemy.path || enemy.path.length === 0) return;

  const waypoint = enemy.path[0];
  const wdx = waypoint.x - enemy.x;
  const wdy = waypoint.y - enemy.y;
  const wdist = Math.hypot(wdx, wdy);
  if (wdist < WAYPOINT_EPSILON) {
    enemy.path.shift();
    return;
  }

  const step = Math.min(enemy.speed * dt, wdist);
  const moved = tryMoveEnemy(map, enemy.x, enemy.y, (wdx / wdist) * step, (wdy / wdist) * step, enemy.width / 2);
  enemy.x = moved.x;
  enemy.y = moved.y;
}

/** An enemy only reacts once the player is within detectionRangeCells (straight-line,
 * walls don't block detection itself — only attacking and direct-line movement need
 * line of sight, checked via the same raycastWallDistance helper combat.ts uses for
 * hitscan). Once aware, behavior branches: "chase" closes distance and melee-attacks
 * (instant damage) in range; "stationary" never moves and fires a projectile (via
 * combat.ts's updateProjectiles) at anything that wanders into range (turret/sentry);
 * "ranged" fires the same kind of projectile from range and backs away for as long as
 * the player stays within attackRangeCells (kiting), closing distance again once out of
 * range. Attacking always requires line of sight (no shooting through walls). Movement
 * prefers a direct line when LOS is clear; when it's blocked, "chase" and "ranged" fall
 * back to an A* route around the wall (see pathfinding.ts's findPath) instead of just
 * stopping — recomputed every PATH_RECOMPUTE_MS to track the player. "stationary"
 * enemies never path, matching that they never move at all. */
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
    if (dist <= 0 || dist > enemy.detectionRangeCells) {
      enemy.path = null;
      continue;
    }

    const dirX = dx / dist;
    const dirY = dy / dist;
    const hasLineOfSight = raycastWallDistance(map, enemy.x, enemy.y, dirX, dirY, dist) >= dist;

    if (!hasLineOfSight) {
      if (enemy.behavior !== "stationary") moveAlongPath(enemy, map, player, dt);
      continue;
    }
    enemy.path = null;

    const inAttackRange = dist <= enemy.attackRangeCells;
    if (inAttackRange && enemy.attackCooldownMs <= 0) {
      if (enemy.behavior === "stationary" || enemy.behavior === "ranged") {
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
    if (enemy.behavior === "ranged" && inAttackRange) {
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
