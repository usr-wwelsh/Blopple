import type { TextureDef } from "./textureSchema";
import type { Song, SfxDef } from "./musicSchema";
import type { WeaponDef, WeaponPickup } from "./weaponSchema";
import type { PlayerDef } from "./playerSchema";

export const SCHEMA_VERSION = 1;

/** 0 = floor level, 1 = mid platform, 2 = raised platform — a doom-style step, not free-form height. */
export type HeightLevel = 0 | 1 | 2;

export interface Cell {
  x: number;
  y: number;
  height: HeightLevel;
  wallTextureId: string | null;
  floorTextureId: string | null;
  ceilingTextureId: string | null;
  isDoor: boolean;
}

export interface EnemyPlacement {
  enemyId: string;
  x: number;
  y: number;
  facing: number;
}

export interface MapData {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  width: number;
  height: number;
  cells: Cell[];
  enemies: EnemyPlacement[];
  textures: TextureDef[];
  songs: Song[];
  sfx: SfxDef[];
  weapons: WeaponDef[];
  weaponPickups: WeaponPickup[];
  player: PlayerDef;
  playerStart: { x: number; y: number; facing: number };
}
