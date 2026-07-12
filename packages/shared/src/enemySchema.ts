export const ENEMY_SCHEMA_VERSION = 1;

export interface SpriteFrames {
  /** pixel-grid frames, each a square NxN indexed-color grid, referencing a shared palette */
  idle: string[];
  walk: string[];
  attack: string[];
  hurt: string[];
  death: string[];
}

export interface EnemyDef {
  schemaVersion: typeof ENEMY_SCHEMA_VERSION;
  id: string;
  name: string;
  health: number;
  speed: number;
  damage: number;
  attackRangeCells: number;
  sprites: SpriteFrames;
}
