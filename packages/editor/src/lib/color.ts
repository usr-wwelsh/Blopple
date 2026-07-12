export const PALETTE = [
  "#000000",
  "#444444",
  "#888888",
  "#cccccc",
  "#ffffff",
  "#c0392b",
  "#e67e22",
  "#f1c40f",
  "#27ae60",
  "#16a085",
  "#2980b9",
  "#2c3e50",
  "#8e44ad",
  "#e84393",
  "#7f5539",
  "#f39c12",
] as const;

export { type TextureRef, parseTextureRef } from "@blopple/shared";

export function textureIdToColor(id: string | null, fallback = "#333333"): string {
  if (!id) return fallback;
  return id.startsWith("color:") ? id.slice(6) : fallback;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
