export const WEAPON_SCHEMA_VERSION = 1;

export interface WeaponSpriteFrames {
  /** pixel-grid frames, each a square NxN indexed-color grid, referencing a shared palette */
  idle: string[];
  fire: string[];
}

export interface WeaponDef {
  schemaVersion: typeof WEAPON_SCHEMA_VERSION;
  id: string;
  name: string;
  damage: number;
  /** cooldown between shots, no ammo tracking in v1 */
  fireRateMs: number;
  rangeCells: number;
  sfxId: string | null;
  sprites: WeaponSpriteFrames;
}

export interface WeaponPickup {
  weaponId: string;
  x: number;
  y: number;
}
