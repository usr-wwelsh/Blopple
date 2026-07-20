import type { MapData, WeaponDef } from "@blopple/shared";
import { raycastWallDistance, type Billboard } from "./engine";
import { damagePlayer, type PlayerState } from "./player";
import { damageEnemy, type EnemyInstance } from "./enemies";

const MELEE_CONE_HALF_ANGLE = Math.PI / 6;
const HITSCAN_HIT_RADIUS = 0.4;
const PROJECTILE_HIT_RADIUS = 0.35;
const ENEMY_PROJECTILE_HIT_RADIUS = 0.4;
const PROJECTILE_VISUAL_SIZE = 0.15;
// fallback when a weapon has no projectileSpriteRef set, so in-flight shots stay visible
const PROJECTILE_COLOR_REF = "color:#ffcc00";

export interface Projectile {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  speed: number;
  remainingRange: number;
  damage: number;
  spriteRef: string | null;
  /** "player" shots damage enemies (fireWeapon); "enemy" shots (stationary behavior,
   * see enemies.ts's updateEnemyAI) damage the player instead. */
  source: "player" | "enemy";
}

function normalizeAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function resolveMeleeTarget(player: PlayerState, weapon: WeaponDef, enemies: EnemyInstance[]): EnemyInstance | null {
  let best: EnemyInstance | null = null;
  let bestDist = Infinity;
  for (const enemy of enemies) {
    if (enemy.isDead) continue;
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const dist = Math.hypot(dx, dy);
    if (dist > weapon.rangeCells) continue;
    if (Math.abs(normalizeAngle(Math.atan2(dy, dx) - player.angle)) > MELEE_CONE_HALF_ANGLE) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = enemy;
    }
  }
  return best;
}

function resolveHitscanTarget(
  map: MapData,
  player: PlayerState,
  weapon: WeaponDef,
  enemies: EnemyInstance[],
): EnemyInstance | null {
  const dirX = Math.cos(player.angle);
  const dirY = Math.sin(player.angle);
  const maxDist = raycastWallDistance(map, player.x, player.y, dirX, dirY, weapon.rangeCells);

  let best: EnemyInstance | null = null;
  let bestT = Infinity;
  for (const enemy of enemies) {
    if (enemy.isDead) continue;
    const ex = enemy.x - player.x;
    const ey = enemy.y - player.y;
    const t = ex * dirX + ey * dirY;
    if (t < 0 || t > maxDist) continue;
    const perp = Math.abs(ex * dirY - ey * dirX);
    if (perp > HITSCAN_HIT_RADIUS) continue;
    if (t < bestT) {
      bestT = t;
      best = enemy;
    }
  }
  return best;
}

/** Dispatches a just-fired shot from the equipped weapon: melee/hitscan resolve and
 * apply damage immediately; projectile spawns a travelling entity that updateProjectiles
 * simulates on subsequent frames. */
export function fireWeapon(
  map: MapData,
  player: PlayerState,
  weapon: WeaponDef,
  enemies: EnemyInstance[],
  projectiles: Projectile[],
): void {
  switch (weapon.behavior) {
    case "melee": {
      const target = resolveMeleeTarget(player, weapon, enemies);
      if (target) damageEnemy(target, weapon.damage);
      break;
    }
    case "hitscan": {
      const target = resolveHitscanTarget(map, player, weapon, enemies);
      if (target) damageEnemy(target, weapon.damage);
      break;
    }
    case "projectile": {
      projectiles.push({
        x: player.x,
        y: player.y,
        dirX: Math.cos(player.angle),
        dirY: Math.sin(player.angle),
        speed: weapon.projectileSpeed ?? 0,
        remainingRange: weapon.rangeCells,
        damage: weapon.damage,
        spriteRef: weapon.projectileSpriteRef,
        source: "player",
      });
      break;
    }
  }
}

/** Advances in-flight projectiles one dt, resolving wall/target collisions along the
 * whole step (not just a point check at the new position) so a fast projectile can't
 * tunnel past a target standing between this frame's start and end point. "player"-
 * sourced projectiles test against enemies (fireWeapon's projectile weapons); "enemy"-
 * sourced ones (stationary enemies, see enemies.ts) test against the player instead. */
export function updateProjectiles(
  map: MapData,
  projectiles: Projectile[],
  enemies: EnemyInstance[],
  player: PlayerState,
  dt: number,
): void {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    const step = Math.min(p.speed * dt, p.remainingRange);

    let travel = raycastWallDistance(map, p.x, p.y, p.dirX, p.dirY, step);
    let hitEnemy: EnemyInstance | null = null;
    let hitPlayer = false;

    if (p.source === "player") {
      for (const enemy of enemies) {
        if (enemy.isDead) continue;
        const ex = enemy.x - p.x;
        const ey = enemy.y - p.y;
        const t = ex * p.dirX + ey * p.dirY;
        if (t < 0 || t > travel) continue;
        const perp = Math.abs(ex * p.dirY - ey * p.dirX);
        if (perp > PROJECTILE_HIT_RADIUS) continue;
        travel = t;
        hitEnemy = enemy;
      }
    } else {
      const ex = player.x - p.x;
      const ey = player.y - p.y;
      const t = ex * p.dirX + ey * p.dirY;
      const perp = Math.abs(ex * p.dirY - ey * p.dirX);
      if (t >= 0 && t <= travel && perp <= ENEMY_PROJECTILE_HIT_RADIUS) {
        travel = t;
        hitPlayer = true;
      }
    }

    p.x += p.dirX * travel;
    p.y += p.dirY * travel;
    p.remainingRange -= travel;

    if (hitEnemy) {
      damageEnemy(hitEnemy, p.damage);
      projectiles.splice(i, 1);
    } else if (hitPlayer) {
      damagePlayer(player, p.damage);
      projectiles.splice(i, 1);
    } else if (travel < step || p.remainingRange <= 0) {
      projectiles.splice(i, 1);
    }
  }
}

export function projectileBillboards(projectiles: Projectile[]): Billboard[] {
  return projectiles.map((p) => ({
    x: p.x,
    y: p.y,
    textureRef: p.spriteRef ?? PROJECTILE_COLOR_REF,
    worldWidth: PROJECTILE_VISUAL_SIZE,
    worldHeight: PROJECTILE_VISUAL_SIZE,
  }));
}
