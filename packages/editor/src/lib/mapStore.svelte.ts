import type { Cell, KeyColor, MapData, TextureDef, Song, Instrument, Pattern, SfxDef } from "@blopple/shared";
import {
  TEXTURE_SCHEMA_VERSION,
  TEXTURE_SIZE,
  MUSIC_SCHEMA_VERSION,
  STEPS_PER_PATTERN,
  PLAYER_SCHEMA_VERSION,
} from "@blopple/shared";
import { INSTRUMENT_PRESETS } from "./musicPresets";

const DEFAULT_SIZE = 48;

function buildCells(width: number, height: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const border = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      cells.push({
        x,
        y,
        height: 0,
        wallTextureId: border ? "color:#888888" : null,
        floorTextureId: "color:#2a2a2a",
        ceilingTextureId: "color:#111111",
        doorColor: null,
        doorOpen: false,
      });
    }
  }
  return cells;
}

function emptyMap(width: number, height: number): MapData {
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: "untitled",
    width,
    height,
    cells: buildCells(width, height),
    enemies: [],
    textures: [],
    songs: [],
    sfx: [],
    weapons: [],
    weaponPickups: [],
    keyPickups: [],
    player: { schemaVersion: PLAYER_SCHEMA_VERSION, health: 100, speed: 3, startingWeaponId: null },
    playerStart: { x: Math.floor(width / 2) + 0.5, y: Math.floor(height / 2) + 0.5, facing: 0 },
    exit: { x: 1.5, y: 1.5, message: "Level Complete" },
  };
}

class MapStore {
  map = $state<MapData>(emptyMap(DEFAULT_SIZE, DEFAULT_SIZE));

  // plain (non-reactive) lookup index, kept in sync on every full map swap —
  // cell mutations happen in place so x/y never change and the index stays valid
  #index = new Map<string, Cell>();

  constructor() {
    this.#reindex();
  }

  #reindex(): void {
    this.#index.clear();
    for (const cell of this.map.cells) this.#index.set(`${cell.x},${cell.y}`, cell);
  }

  cellAt(x: number, y: number): Cell | undefined {
    return this.#index.get(`${x},${y}`);
  }

  newMap(width: number, height: number): void {
    this.map = emptyMap(width, height);
    this.#reindex();
  }

  loadMap(data: MapData): void {
    if (!data.textures) data.textures = [];
    if (!data.songs) data.songs = [];
    if (!data.sfx) data.sfx = [];
    if (!data.weapons) data.weapons = [];
    if (!data.weaponPickups) data.weaponPickups = [];
    if (!data.keyPickups) data.keyPickups = [];
    if (!data.player) {
      data.player = { schemaVersion: PLAYER_SCHEMA_VERSION, health: 100, speed: 3, startingWeaponId: null };
    }
    if (!data.exit) {
      data.exit = { x: 1.5, y: 1.5, message: "Level Complete" };
    }
    // pre-dates doorColor/doorOpen (was a plain isDoor boolean with no lock behavior) — drop it
    for (const cell of data.cells as (Cell & { isDoor?: boolean })[]) {
      if (cell.doorColor === undefined) {
        cell.doorColor = null;
        cell.doorOpen = false;
        delete cell.isDoor;
      }
    }
    this.map = data;
    this.#reindex();
  }

  setKeyPickup(color: KeyColor, x: number, y: number): void {
    const existing = this.map.keyPickups.find((k) => k.color === color);
    if (existing) {
      existing.x = x;
      existing.y = y;
    } else {
      this.map.keyPickups.push({ color, x, y });
    }
  }

  setExit(x: number, y: number): void {
    this.map.exit.x = x;
    this.map.exit.y = y;
  }

  textureAt(id: string): TextureDef | undefined {
    return this.map.textures.find((t) => t.id === id);
  }

  addTexture(): TextureDef {
    const texture: TextureDef = {
      schemaVersion: TEXTURE_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: `texture ${this.map.textures.length + 1}`,
      pixels: new Array(TEXTURE_SIZE * TEXTURE_SIZE).fill(null),
    };
    this.map.textures.push(texture);
    return texture;
  }

  duplicateTexture(id: string): TextureDef | undefined {
    const src = this.textureAt(id);
    if (!src) return undefined;
    const copy: TextureDef = { ...src, id: crypto.randomUUID(), name: `${src.name} copy`, pixels: [...src.pixels] };
    this.map.textures.push(copy);
    return copy;
  }

  removeTexture(id: string): void {
    const idx = this.map.textures.findIndex((t) => t.id === id);
    if (idx === -1) return;
    this.map.textures.splice(idx, 1);
    const ref = `texture:${id}`;
    for (const cell of this.map.cells) {
      if (cell.wallTextureId === ref) cell.wallTextureId = null;
      if (cell.floorTextureId === ref) cell.floorTextureId = null;
      if (cell.ceilingTextureId === ref) cell.ceilingTextureId = null;
    }
  }

  renameTexture(id: string, name: string): void {
    const texture = this.textureAt(id);
    if (texture) texture.name = name;
  }

  // --- music: songs ---

  songAt(id: string): Song | undefined {
    return this.map.songs.find((s) => s.id === id);
  }

  addSong(): Song {
    const song: Song = {
      schemaVersion: MUSIC_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: `song ${this.map.songs.length + 1}`,
      bpm: 120,
      instruments: [],
      patterns: [],
      order: [],
    };
    this.map.songs.push(song);
    return song;
  }

  duplicateSong(id: string): Song | undefined {
    const src = this.songAt(id);
    if (!src) return undefined;
    const copy: Song = structuredClone(src);
    copy.id = crypto.randomUUID();
    copy.name = `${src.name} copy`;
    this.map.songs.push(copy);
    return copy;
  }

  removeSong(id: string): void {
    const idx = this.map.songs.findIndex((s) => s.id === id);
    if (idx !== -1) this.map.songs.splice(idx, 1);
  }

  // --- music: instruments (rows stay index-aligned across a song's patterns) ---

  addInstrument(songId: string, presetLabel: string): Instrument | undefined {
    const song = this.songAt(songId);
    const preset = INSTRUMENT_PRESETS.find((p) => p.label === presetLabel);
    if (!song || !preset) return undefined;
    const instrument: Instrument = { id: crypto.randomUUID(), ...preset.make() };
    song.instruments.push(instrument);
    for (const pattern of song.patterns) pattern.rows.push(new Array(STEPS_PER_PATTERN).fill(-1));
    return instrument;
  }

  duplicateInstrument(songId: string, index: number): Instrument | undefined {
    const song = this.songAt(songId);
    const src = song?.instruments[index];
    if (!song || !src) return undefined;
    const copy: Instrument = { ...src, id: crypto.randomUUID(), name: `${src.name} copy` };
    song.instruments.push(copy);
    for (const pattern of song.patterns) pattern.rows.push(new Array(STEPS_PER_PATTERN).fill(-1));
    return copy;
  }

  removeInstrument(songId: string, index: number): void {
    const song = this.songAt(songId);
    if (!song || index < 0 || index >= song.instruments.length) return;
    song.instruments.splice(index, 1);
    for (const pattern of song.patterns) pattern.rows.splice(index, 1);
  }

  // --- music: patterns ---

  addPattern(songId: string): Pattern | undefined {
    const song = this.songAt(songId);
    if (!song) return undefined;
    const pattern: Pattern = {
      id: crypto.randomUUID(),
      name: `pattern ${song.patterns.length + 1}`,
      rows: song.instruments.map(() => new Array(STEPS_PER_PATTERN).fill(-1)),
    };
    song.patterns.push(pattern);
    return pattern;
  }

  duplicatePattern(songId: string, patternId: string): Pattern | undefined {
    const song = this.songAt(songId);
    const src = song?.patterns.find((p) => p.id === patternId);
    if (!song || !src) return undefined;
    const copy: Pattern = { id: crypto.randomUUID(), name: `${src.name} copy`, rows: src.rows.map((row) => [...row]) };
    song.patterns.push(copy);
    return copy;
  }

  removePattern(songId: string, patternId: string): void {
    const song = this.songAt(songId);
    if (!song) return;
    song.patterns = song.patterns.filter((p) => p.id !== patternId);
    song.order = song.order.filter((id) => id !== patternId);
  }

  // --- sound effects ---

  sfxAt(id: string): SfxDef | undefined {
    return this.map.sfx.find((s) => s.id === id);
  }

  addSfx(category: SfxDef["category"]): SfxDef {
    const preset = INSTRUMENT_PRESETS[0];
    const sfx: SfxDef = {
      schemaVersion: MUSIC_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: `${category} sfx ${this.map.sfx.length + 1}`,
      category,
      instrument: { id: crypto.randomUUID(), ...preset.make() },
      note: 0,
    };
    this.map.sfx.push(sfx);
    return sfx;
  }

  duplicateSfx(id: string): SfxDef | undefined {
    const src = this.sfxAt(id);
    if (!src) return undefined;
    const copy: SfxDef = structuredClone(src);
    copy.id = crypto.randomUUID();
    copy.instrument.id = crypto.randomUUID();
    copy.name = `${src.name} copy`;
    this.map.sfx.push(copy);
    return copy;
  }

  removeSfx(id: string): void {
    const idx = this.map.sfx.findIndex((s) => s.id === id);
    if (idx !== -1) this.map.sfx.splice(idx, 1);
  }
}

export const mapStore = new MapStore();
