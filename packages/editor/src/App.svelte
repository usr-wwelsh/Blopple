<script lang="ts">
  import Toolbar from "./components/Toolbar.svelte";
  import MapGrid from "./components/MapGrid.svelte";
  import MapPreview3D from "./components/MapPreview3D.svelte";
  import PlayTest from "./components/PlayTest.svelte";
  import TextureEditor from "./components/TextureEditor.svelte";
  import MusicEditor from "./components/MusicEditor.svelte";
  import WeaponEditor from "./components/WeaponEditor.svelte";
  import { mapStore } from "./lib/mapStore.svelte";

  type Tab = "map" | "preview" | "play" | "textures" | "music" | "weapons";

  const tabs: { id: Tab; label: string; enabled: boolean }[] = [
    { id: "map", label: "Tile Map", enabled: true },
    { id: "preview", label: "3D Preview", enabled: true },
    { id: "play", label: "Play", enabled: true },
    { id: "textures", label: "Textures", enabled: true },
    { id: "music", label: "Music", enabled: true },
    { id: "weapons", label: "Weapons", enabled: true },
  ];

  let activeTab = $state<Tab>("map");

  let newWidth = $state(mapStore.map.width);
  let newHeight = $state(mapStore.map.height);

  function createNewMap(): void {
    if (!confirm(`Start a new ${newWidth}x${newHeight} map? Unsaved changes will be lost.`)) return;
    mapStore.newMap(newWidth, newHeight);
  }

  function exportMap(): void {
    const blob = new Blob([JSON.stringify(mapStore.map, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mapStore.map.name || "map"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importMap(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      mapStore.loadMap(JSON.parse(text));
    });
    input.value = "";
  }
</script>

<main>
  <div class="header">
    <div class="tabs">
      {#each tabs as t (t.id)}
        <button
          class:active={activeTab === t.id}
          disabled={!t.enabled}
          title={t.enabled ? "" : "coming soon"}
          onclick={() => (activeTab = t.id)}
        >
          {t.label}
        </button>
      {/each}
    </div>

    <div class="doc-actions">
      <input class="dim" type="number" min="8" max="256" bind:value={newWidth} />
      <span>x</span>
      <input class="dim" type="number" min="8" max="256" bind:value={newHeight} />
      <button onclick={createNewMap}>New Map</button>
      <button onclick={exportMap}>Export</button>
      <label class="import">
        Import
        <input type="file" accept="application/json" onchange={importMap} />
      </label>
    </div>
  </div>

  {#if activeTab === "map"}
    <Toolbar />
    <div class="grid-pane">
      <MapGrid />
    </div>
  {:else if activeTab === "preview"}
    <div class="preview-pane">
      <MapPreview3D />
    </div>
  {:else if activeTab === "play"}
    <div class="preview-pane">
      <PlayTest />
    </div>
  {:else if activeTab === "textures"}
    <TextureEditor />
  {:else if activeTab === "music"}
    <MusicEditor />
  {:else if activeTab === "weapons"}
    <WeaponEditor />
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    background: #111;
    color: #eee;
    font-family: monospace;
  }
  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.5rem;
    background: #1a1a1a;
    border-bottom: 1px solid #444;
  }
  .tabs,
  .doc-actions {
    display: flex;
    gap: 0.25rem;
    align-items: center;
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
  button:disabled {
    color: #555;
    cursor: not-allowed;
  }
  .dim {
    width: 3.5rem;
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
  }
  .import {
    position: relative;
    overflow: hidden;
    background: #2a2a2a;
    border: 1px solid #444;
    padding: 0.3rem 0.6rem;
    cursor: pointer;
  }
  .import input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .grid-pane {
    flex: 1;
    overflow: auto;
    padding: 1rem;
  }
  .preview-pane {
    flex: 1;
  }
</style>
