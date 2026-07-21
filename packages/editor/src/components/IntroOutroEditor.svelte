<script lang="ts">
  import type { BackgroundMode } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import TextureRefPicker from "./TextureRefPicker.svelte";

  type Screen = "intro" | "outro";
  const screens: { id: Screen; label: string; hint: string }[] = [
    { id: "intro", label: "Intro", hint: "Shown before gameplay starts, waiting for a key press or click." },
    { id: "outro", label: "Outro", hint: "Shown once the player reaches the exit." },
  ];

  function onMusicChange(screen: Screen, e: Event): void {
    mapStore.setIntroOutroMusic(screen, (e.target as HTMLSelectElement).value || null);
  }

  function onTextChange(screen: Screen, e: Event): void {
    const lines = (e.target as HTMLTextAreaElement).value.split("\n");
    mapStore.setIntroOutroText(screen, lines);
  }

  function setMode(screen: Screen, mode: BackgroundMode): void {
    mapStore.setIntroOutroBackgroundMode(screen, mode);
  }
</script>

<div class="intro-outro-editor">
  {#each screens as screen (screen.id)}
    {@const config = mapStore.introOutroAt(screen.id)}
    <div class="screen-panel">
      <span class="section-label">{screen.label}</span>
      <span class="hint">{screen.hint}</span>

      <label class="row">
        Music
        <select value={config.musicId ?? ""} onchange={(e) => onMusicChange(screen.id, e)}>
          <option value="">None</option>
          {#if mapStore.map.songs.length > 0}
            <optgroup label="Songs">
              {#each mapStore.map.songs as s (s.id)}
                <option value={`song:${s.id}`}>{s.name}</option>
              {/each}
            </optgroup>
          {/if}
          {#if mapStore.map.audioTracks.length > 0}
            <optgroup label="Imported audio">
              {#each mapStore.map.audioTracks as t (t.id)}
                <option value={`track:${t.id}`}>{t.name}</option>
              {/each}
            </optgroup>
          {/if}
        </select>
      </label>

      <label class="block">
        <span>Scrolling text (one line each)</span>
        <textarea rows="6" value={config.text.join("\n")} oninput={(e) => onTextChange(screen.id, e)}></textarea>
      </label>

      <label class="row">
        Text color
        <input
          type="color"
          value={config.textColor}
          oninput={(e) => mapStore.setIntroOutroTextColor(screen.id, (e.target as HTMLInputElement).value)}
        />
      </label>

      <div class="block">
        <span>Background</span>
        <TextureRefPicker value={config.backgroundId} onChange={(ref) => mapStore.setIntroOutroBackground(screen.id, ref)} />
        <div class="mode-row">
          <button class="chip" class:active={config.backgroundMode === "tile"} onclick={() => setMode(screen.id, "tile")}>Tile</button>
          <button class="chip" class:active={config.backgroundMode === "stretch"} onclick={() => setMode(screen.id, "stretch")}>Stretch</button>
        </div>
      </div>
    </div>
  {/each}
</div>

<style>
  .intro-outro-editor {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: auto;
  }
  .screen-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    padding: 1rem;
  }
  .screen-panel:first-child {
    border-right: 1px solid #333;
  }
  .section-label {
    color: #888;
    font-size: 0.75em;
    text-transform: uppercase;
  }
  .hint {
    color: #888;
    font-size: 0.85em;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9em;
    color: #bbb;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: 0.9em;
    color: #bbb;
  }
  select,
  textarea {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
  }
  input[type="color"] {
    width: 2.5rem;
    height: 1.6rem;
    padding: 2px;
    background: #2a2a2a;
    border: 1px solid #444;
    cursor: pointer;
  }
  textarea {
    resize: vertical;
    font-family: monospace;
  }
  .mode-row {
    display: flex;
    gap: 0.25rem;
  }
  .chip {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.85em;
  }
  .chip.active {
    background: #555;
    border-color: #888;
  }
</style>
