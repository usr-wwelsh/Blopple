export const TEXTURE_SCHEMA_VERSION = 1;
export const TEXTURE_SIZE = 64;

export interface TextureDef {
  schemaVersion: typeof TEXTURE_SCHEMA_VERSION;
  id: string;
  name: string;
  /** TEXTURE_SIZE * TEXTURE_SIZE pixels, row-major; hex color or null for transparent */
  pixels: (string | null)[];
}

/** wallTextureId/floorTextureId/ceilingTextureId are either "color:#rrggbb" (flat paint)
 * or "texture:<id>" (references a TextureDef in MapData.textures). */
export type TextureRef = { kind: "color"; color: string } | { kind: "texture"; id: string };

export function parseTextureRef(id: string | null): TextureRef | null {
  if (!id) return null;
  if (id.startsWith("color:")) return { kind: "color", color: id.slice(6) };
  if (id.startsWith("texture:")) return { kind: "texture", id: id.slice(8) };
  return null;
}
