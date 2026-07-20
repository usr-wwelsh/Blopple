import type { MapData } from "@blopple/shared";
import type { Billboard } from "./engine";

const HIT_FLASH_MS = 150;
const HIT_FLASH_COLOR = "#ff2020";

/** Per-placement runtime state resolved from map.enemies + map.enemyDefs. Movement/AI
 * are a later session — this is just enough state for weapon hits to land somewhere. */
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
      },
    ];
  });
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
