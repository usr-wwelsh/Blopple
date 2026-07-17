<script lang="ts">
  import { mapStore } from "../lib/mapStore.svelte";
  import SongEditor from "./SongEditor.svelte";
  import SfxEditor from "./SfxEditor.svelte";
  import AudioTrackEditor from "./AudioTrackEditor.svelte";

  type SubTab = "songs" | "audio" | "sfx";
  let subTab = $state<SubTab>("songs");

  function onGameplaySongChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    mapStore.setGameplayMusic(value || null);
  }

  function onOutroSongChange(e: Event): void {
    const value = (e.target as HTMLSelectElement).value;
    mapStore.setOutroMusic(value || null);
  }
</script>

<div class="music-editor">
  <div class="level-music">
    <label>
      Gameplay Music
      <select value={mapStore.map.music.gameplaySongId ?? ""} onchange={onGameplaySongChange}>
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
    <label>
      Outro Music
      <select value={mapStore.map.music.outroSongId ?? ""} onchange={onOutroSongChange}>
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
  </div>

  <div class="sub-tabs">
    <button class:active={subTab === "songs"} onclick={() => (subTab = "songs")}>Songs</button>
    <button class:active={subTab === "audio"} onclick={() => (subTab = "audio")}>Imported Audio</button>
    <button class:active={subTab === "sfx"} onclick={() => (subTab = "sfx")}>Sound FX</button>
  </div>

  {#if subTab === "songs"}
    <SongEditor />
  {:else if subTab === "audio"}
    <AudioTrackEditor />
  {:else}
    <SfxEditor />
  {/if}
</div>

<style>
  .music-editor {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }
  .level-music {
    display: flex;
    gap: 1.5rem;
    padding: 0.5rem;
    border-bottom: 1px solid #333;
  }
  .level-music label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9em;
    color: #bbb;
  }
  .level-music select {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
  }
  .sub-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.5rem;
    border-bottom: 1px solid #333;
  }
  button {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    font: inherit;
  }
  button.active {
    background: #555;
    border-color: #888;
  }
</style>
