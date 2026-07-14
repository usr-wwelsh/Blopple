import type { KeyColor } from "@blopple/shared";

export type Tool = "wall" | "floor" | "ceiling" | "door" | "key" | "weapon" | "exit" | "height" | "playerStart" | "erase";

export const BRUSH_SIZES = [1, 3, 5, 7] as const;
export type BrushSize = (typeof BRUSH_SIZES)[number];

export type PaintMode = "color" | "texture";
export type PixelTool = "pencil" | "eraser" | "fill";

class ToolStore {
  tool = $state<Tool>("wall");
  height = $state<0 | 1 | 2>(1);
  color = $state("#888888");
  brushSize = $state<BrushSize>(1);

  // shared by the door tool (which color to lock the door with) and the key tool
  // (which colored key pickup to place)
  keyColor = $state<KeyColor>("red");

  // weapon tool: which weapon's pickup to place
  selectedWeaponId = $state<string | null>(null);

  // wall/floor/ceiling painting: flat color vs. a painted texture
  paintMode = $state<PaintMode>("color");
  selectedTextureId = $state<string | null>(null);

  // texture pixel-art editor
  pixelTool = $state<PixelTool>("pencil");
  pixelBrushSize = $state<BrushSize>(1);
}

export const toolStore = new ToolStore();
