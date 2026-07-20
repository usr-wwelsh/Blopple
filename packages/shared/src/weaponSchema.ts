export const WEAPON_SCHEMA_VERSION = 1;

export type WeaponBehavior = "melee" | "hitscan" | "projectile";

export interface WeaponSpriteFrames {
  /** texture ref, same format as Cell.wallTextureId: "texture:<id>" | "color:#rrggbb" | null */
  idle: string | null;
  fire: string | null;
}

export interface WeaponDef {
  schemaVersion: typeof WEAPON_SCHEMA_VERSION;
  id: string;
  name: string;
  behavior: WeaponBehavior;
  damage: number;
  /** cooldown between shots, no ammo tracking in v1 */
  fireRateMs: number;
  /** melee/hitscan reach; projectile max travel distance */
  rangeCells: number;
  /** cells per second, only meaningful when behavior === "projectile" */
  projectileSpeed: number | null;
  /** texture ref for the in-flight projectile billboard, same format as Cell.wallTextureId.
   * Only meaningful when behavior === "projectile"; null falls back to a flat placeholder color. */
  projectileSpriteRef: string | null;
  sfxId: string | null;
  sprites: WeaponSpriteFrames;
}

export interface WeaponPickup {
  weaponId: string;
  x: number;
  y: number;
}
