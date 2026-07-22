import type { MapData } from "@blopple/shared";

const STORAGE_KEY = "blopple.recentSaves";
const MAX_SAVES = 20;

export interface RecentSave {
  id: string;
  name: string;
  savedAt: number;
  map: MapData;
}

function readAll(): RecentSave[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentSave[]) : [];
  } catch {
    return [];
  }
}

function writeAll(saves: RecentSave[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  } catch {
    // storage quota exceeded — drop the oldest half and retry once
    const trimmed = saves.slice(0, Math.ceil(saves.length / 2));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // still failing; the file export already succeeded so just drop this copy
    }
  }
}

export function listRecentSaves(): RecentSave[] {
  return readAll().sort((a, b) => b.savedAt - a.savedAt);
}

export function saveRecentSave(map: MapData): void {
  const saves = readAll();
  const existing = saves.find((s) => s.id === map.id);
  const remaining = saves.filter((s) => s.id !== map.id);
  remaining.unshift({ id: map.id, name: existing?.name ?? (map.name || "untitled"), savedAt: Date.now(), map });
  writeAll(remaining.slice(0, MAX_SAVES));
}

export function renameRecentSave(id: string, name: string): void {
  const saves = readAll();
  const entry = saves.find((s) => s.id === id);
  if (entry) entry.name = name;
  writeAll(saves);
}

export function deleteRecentSave(id: string): void {
  writeAll(readAll().filter((s) => s.id !== id));
}
