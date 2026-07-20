export const ENEMY_SCHEMA_VERSION = 1;

/** chase: closes distance and melee-attacks (instant damage) once in range. stationary:
 * never moves, fires a projectile at anything that wanders into range (turret/sentry).
 * ranged: fires the same kind of projectile from range, backing off if the player gets
 * too close (kiting). */
export type EnemyBehavior = "chase" | "stationary" | "ranged";

export interface EnemyDef {
  schemaVersion: typeof ENEMY_SCHEMA_VERSION;
  id: string;
  name: string;
  health: number;
  behavior: EnemyBehavior;
  /** cells per second */
  speed: number;
  damage: number;
  attackRangeCells: number;
  /** cooldown between attacks once in range, same convention as WeaponDef.fireRateMs */
  attackRateMs: number;
  /** enemy ignores the player entirely beyond this distance (or without line of sight) */
  detectionRangeCells: number;
  /** cells per second; only meaningful when behavior is "stationary" or "ranged", which
   * attack by firing a projectile instead of the instant hit "chase" lands on contact */
  projectileSpeed: number | null;
  /** texture ref for the in-flight projectile billboard, same format as Cell.wallTextureId.
   * Only meaningful when behavior is "stationary" or "ranged". */
  projectileSpriteRef: string | null;
  /** billboard size in world units (cells) */
  width: number;
  height: number;
  /** texture ref, same format as Cell.wallTextureId: "texture:<id>" | "color:#rrggbb" | null */
  spriteRef: string | null;
}
