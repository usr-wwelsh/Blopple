export const PLAYER_SCHEMA_VERSION = 1;

export interface PlayerDef {
  schemaVersion: typeof PLAYER_SCHEMA_VERSION;
  health: number;
  /** cells per second */
  speed: number;
  startingWeaponId: string | null;
}
