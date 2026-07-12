# Blopple

A no-code, browser-based Doom-style map/enemy/music editor that exports standalone playable web games small enough for itch.io. Maps are grid-based with three discrete height steps rather than free-form sectors, keeping both the editor and the exported runtime simple; the editor targets ~10MB and every exported game targets ~1MB. It's a `bun` workspace monorepo: `packages/editor` (Vite + Svelte 5 + three.js) is the tool you build games in, `packages/runtime` (vanilla TypeScript, hand-rolled Canvas2D raycaster) is the engine that ships inside exported games, and `packages/shared` holds the map/enemy/weapon/music schemas both packages read from.

## Progress

- **Map editor** — paint walls/floors/ceilings/doors, three height levels, brush sizes, zoom/pan, live three.js 3D preview, in-editor playtest, JSON export/import.
- **Textures** — pixel-art tool for authoring wall/floor textures.
- **Music/SFX** — tracker-style song editor, synth/instrument controls, one-shot SFX editor.
- **Schemas only, no gameplay yet** — `weaponSchema.ts` and `enemySchema.ts` define the data shapes, but there's no weapon or enemy editor UI, and the runtime has no combat, projectiles, or enemy AI.

## Roadmap

1. **Weapons** — editor UI + runtime support for projectiles, melee, and ranged attacks.
2. **Enemies** — sprites, animations, melee/ranged attacks, stats, runtime AI.
3. **Export pipeline** — bundle map JSON + runtime engine + assets into a single minified `index.html`, ~1MB target. Right now export/import only round-trips map *data* for editing, not a playable build.

## Known limitations (deliberately deferred, not bugs)

- **Height is a single-value heightfield per cell** (0/1/2). It can't represent a second story you walk *under* — that needs multiple floor/ceiling spans per cell plus a portal/sector-based renderer instead of the current single-hit-per-column raycaster.
- **No windows in walls** — the runtime raycaster stops at the first wall hit per ray, so seeing through a window requires the ray to continue past it and composite. Not started.
