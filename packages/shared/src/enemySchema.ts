export const ENEMY_SCHEMA_VERSION = 1;

export interface EnemyDef {
  schemaVersion: typeof ENEMY_SCHEMA_VERSION;
  id: string;
  name: string;
  health: number;
  /** cells per second */
  speed: number;
  damage: number;
  attackRangeCells: number;
  /** billboard size in world units (cells) */
  width: number;
  height: number;
  /** texture ref, same format as Cell.wallTextureId: "texture:<id>" | "color:#rrggbb" | null */
  spriteRef: string | null;
}
