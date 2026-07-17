import type { Cell, KeyColor, MapData, TextureDef, Song, AudioTrackDef, Instrument, Pattern, SfxDef, SfxLayer, WeaponDef } from "@blopple/shared";
import {
  TEXTURE_SCHEMA_VERSION,
  TEXTURE_SIZE,
  MUSIC_SCHEMA_VERSION,
  STEPS_PER_PATTERN,
  PLAYER_SCHEMA_VERSION,
  WEAPON_SCHEMA_VERSION,
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

function presetInstrument(label: string): Instrument {
  const preset = INSTRUMENT_PRESETS.find((p) => p.label === label)!;
  return { id: crypto.randomUUID(), ...preset.make() };
}

function makeLayer(label: string, note: number, delay: number, gain: number): SfxLayer {
  return { id: crypto.randomUUID(), instrument: presetInstrument(label), note, delay, gain };
}

/** Default weapon sfx: a stacked wall-of-noise explosion — sub boom + filtered noise blast
 *  + a short delayed high crackle for texture — rather than a single plain synth blip. */
function explosionLayers(): SfxLayer[] {
  const crackle = makeLayer("Noise Wall", 0, 0.02, 0.5);
  crackle.instrument.name = "Crackle";
  crackle.instrument.filterType = "highpass";
  crackle.instrument.filterCutoff = 2500;
  crackle.instrument.filterEnvAmount = 0;
  crackle.instrument.decay = 0.05;
  crackle.instrument.sustain = 0;
  crackle.instrument.release = 0.1;
  crackle.instrument.distortion = 0.7;
  return [makeLayer("Sub Boom", -24, 0, 1), makeLayer("Noise Wall", 0, 0, 0.9), crackle];
}

function defaultLayers(): SfxLayer[] {
  return [makeLayer("Square Synth", 0, 0, 1)];
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
    audioTracks: [],
    music: { gameplaySongId: null, outroSongId: null },
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
    if (!data.audioTracks) data.audioTracks = [];
    if (!data.music) data.music = { gameplaySongId: null, outroSongId: null };
    // pre-dates imported audio tracks — gameplaySongId/outroSongId were bare Song ids;
    // tag them so they parse as MusicRef alongside the new "track:<id>" form
    if (data.music.gameplaySongId && !data.music.gameplaySongId.includes(":")) {
      data.music.gameplaySongId = `song:${data.music.gameplaySongId}`;
    }
    if (data.music.outroSongId && !data.music.outroSongId.includes(":")) {
      data.music.outroSongId = `song:${data.music.outroSongId}`;
    }
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
    // pre-dates layered sfx (was a single instrument+note pair) — wrap it as a one-layer stack
    for (const sfx of data.sfx as (SfxDef & { instrument?: Instrument; note?: number })[]) {
      if (!sfx.layers) {
        sfx.layers = [{ id: crypto.randomUUID(), instrument: sfx.instrument!, note: sfx.note ?? 0, delay: 0, gain: 1 }];
        delete sfx.instrument;
        delete sfx.note;
      }
    }
    // pre-dates filter/noise/pitch-envelope/distortion controls — neutral defaults preserve
    // old playback exactly, except brass which used to get a hardcoded lowpass in the engine
    for (const instrument of data.songs.flatMap((s) => s.instruments).concat(data.sfx.flatMap((s) => s.layers.map((l) => l.instrument))) as Partial<Instrument>[]) {
      if (instrument.noiseMix !== undefined) continue;
      instrument.noiseMix = 0;
      instrument.filterType = instrument.kind === "brass" ? "lowpass" : "none";
      instrument.filterCutoff = instrument.kind === "brass" ? 2200 : 20000;
      instrument.filterQ = instrument.kind === "brass" ? 4 : 1;
      instrument.filterEnvAmount = 0;
      instrument.pitchDecay = 0;
      instrument.distortion = 0;
    }
    // pre-dates doorColor/doorOpen (was a plain isDoor boolean with no lock behavior) — drop it
    for (const cell of data.cells as (Cell & { isDoor?: boolean })[]) {
      if (cell.doorColor === undefined) {
        cell.doorColor = null;
        cell.doorOpen = false;
        delete cell.isDoor;
      }
    }
    // pre-dates behavior/projectileSpeed and the texture-ref sprite format (was raw idle/fire pixel-frame arrays)
    for (const weapon of data.weapons as (WeaponDef & { sprites: { idle: unknown; fire: unknown } })[]) {
      if ((weapon as Partial<WeaponDef>).behavior === undefined) weapon.behavior = "hitscan";
      if ((weapon as Partial<WeaponDef>).projectileSpeed === undefined) weapon.projectileSpeed = null;
      if (Array.isArray(weapon.sprites.idle)) weapon.sprites.idle = null;
      if (Array.isArray(weapon.sprites.fire)) weapon.sprites.fire = null;
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

  // --- weapons ---

  weaponAt(id: string): WeaponDef | undefined {
    return this.map.weapons.find((w) => w.id === id);
  }

  addWeapon(): WeaponDef {
    const weapon: WeaponDef = {
      schemaVersion: WEAPON_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: `weapon ${this.map.weapons.length + 1}`,
      behavior: "hitscan",
      damage: 10,
      fireRateMs: 400,
      rangeCells: 5,
      projectileSpeed: null,
      sfxId: null,
      sprites: { idle: null, fire: null },
    };
    this.map.weapons.push(weapon);
    return weapon;
  }

  duplicateWeapon(id: string): WeaponDef | undefined {
    const src = this.weaponAt(id);
    if (!src) return undefined;
    const copy: WeaponDef = { ...src, id: crypto.randomUUID(), name: `${src.name} copy`, sprites: { ...src.sprites } };
    this.map.weapons.push(copy);
    return copy;
  }

  removeWeapon(id: string): void {
    const idx = this.map.weapons.findIndex((w) => w.id === id);
    if (idx === -1) return;
    this.map.weapons.splice(idx, 1);
    if (this.map.player.startingWeaponId === id) this.map.player.startingWeaponId = null;
    this.map.weaponPickups = this.map.weaponPickups.filter((p) => p.weaponId !== id);
  }

  placeWeaponPickup(weaponId: string, x: number, y: number): void {
    this.map.weaponPickups = this.map.weaponPickups.filter((p) => !(Math.floor(p.x) === Math.floor(x) && Math.floor(p.y) === Math.floor(y)));
    this.map.weaponPickups.push({ weaponId, x, y });
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
    if (idx === -1) return;
    this.map.songs.splice(idx, 1);
    const ref = `song:${id}`;
    if (this.map.music.gameplaySongId === ref) this.map.music.gameplaySongId = null;
    if (this.map.music.outroSongId === ref) this.map.music.outroSongId = null;
  }

  setGameplayMusic(ref: string | null): void {
    this.map.music.gameplaySongId = ref;
  }

  setOutroMusic(ref: string | null): void {
    this.map.music.outroSongId = ref;
  }

  // --- music: imported audio tracks ---

  audioTrackAt(id: string): AudioTrackDef | undefined {
    return this.map.audioTracks.find((t) => t.id === id);
  }

  addAudioTrack(name: string, dataUrl: string): AudioTrackDef {
    const track: AudioTrackDef = {
      schemaVersion: MUSIC_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name,
      dataUrl,
    };
    this.map.audioTracks.push(track);
    return track;
  }

  removeAudioTrack(id: string): void {
    const idx = this.map.audioTracks.findIndex((t) => t.id === id);
    if (idx === -1) return;
    this.map.audioTracks.splice(idx, 1);
    const ref = `track:${id}`;
    if (this.map.music.gameplaySongId === ref) this.map.music.gameplaySongId = null;
    if (this.map.music.outroSongId === ref) this.map.music.outroSongId = null;
  }

  renameAudioTrack(id: string, name: string): void {
    const track = this.audioTrackAt(id);
    if (track) track.name = name;
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
    const sfx: SfxDef = {
      schemaVersion: MUSIC_SCHEMA_VERSION,
      id: crypto.randomUUID(),
      name: `${category} sfx ${this.map.sfx.length + 1}`,
      category,
      layers: category === "weapon" ? explosionLayers() : defaultLayers(),
    };
    this.map.sfx.push(sfx);
    return sfx;
  }

  duplicateSfx(id: string): SfxDef | undefined {
    const src = this.sfxAt(id);
    if (!src) return undefined;
    const copy: SfxDef = structuredClone(src);
    copy.id = crypto.randomUUID();
    copy.name = `${src.name} copy`;
    for (const layer of copy.layers) {
      layer.id = crypto.randomUUID();
      layer.instrument.id = crypto.randomUUID();
    }
    this.map.sfx.push(copy);
    return copy;
  }

  removeSfx(id: string): void {
    const idx = this.map.sfx.findIndex((s) => s.id === id);
    if (idx !== -1) this.map.sfx.splice(idx, 1);
  }

  addSfxLayer(sfxId: string): SfxLayer | undefined {
    const sfx = this.sfxAt(sfxId);
    if (!sfx) return undefined;
    const layer = makeLayer("Square Synth", 0, 0, 1);
    sfx.layers.push(layer);
    return layer;
  }

  duplicateSfxLayer(sfxId: string, layerId: string): SfxLayer | undefined {
    const sfx = this.sfxAt(sfxId);
    const src = sfx?.layers.find((l) => l.id === layerId);
    if (!sfx || !src) return undefined;
    const copy: SfxLayer = structuredClone(src);
    copy.id = crypto.randomUUID();
    copy.instrument.id = crypto.randomUUID();
    sfx.layers.push(copy);
    return copy;
  }

  removeSfxLayer(sfxId: string, layerId: string): void {
    const sfx = this.sfxAt(sfxId);
    if (!sfx || sfx.layers.length <= 1) return;
    sfx.layers = sfx.layers.filter((l) => l.id !== layerId);
  }
}

export const mapStore = new MapStore();
