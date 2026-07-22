<script lang="ts">
  import Toolbar from "./components/Toolbar.svelte";
  import MapGrid from "./components/MapGrid.svelte";
  import MapPreview3D from "./components/MapPreview3D.svelte";
  import PlayTest from "./components/PlayTest.svelte";
  import TextureEditor from "./components/TextureEditor.svelte";
  import MusicEditor from "./components/MusicEditor.svelte";
  import IntroOutroEditor from "./components/IntroOutroEditor.svelte";
  import WeaponEditor from "./components/WeaponEditor.svelte";
  import EnemyEditor from "./components/EnemyEditor.svelte";
  import WelcomeModal from "./components/WelcomeModal.svelte";
  import RecentSavesModal from "./components/RecentSavesModal.svelte";
  import ExportModal from "./components/ExportModal.svelte";
  import { mapStore } from "./lib/mapStore.svelte";
  import { saveRecentSave } from "./lib/recentSaves";
  import type { MapData } from "@blopple/shared";

  let showWelcome = $state(true);
  let showRecentSaves = $state(false);
  let showExport = $state(false);

  function dismissWelcome(): void {
    showWelcome = false;
  }

  function openRecentSaves(): void {
    showWelcome = false;
    showRecentSaves = true;
  }

  function loadRecentSave(map: MapData): void {
    mapStore.loadMap(map);
    showRecentSaves = false;
  }

  type Tab = "map" | "preview" | "play" | "textures" | "music" | "introOutro" | "weapons" | "enemies";

  const tabs: { id: Tab; label: string; enabled: boolean }[] = [
    { id: "map", label: "Tile Map", enabled: true },
    { id: "preview", label: "3D Preview", enabled: true },
    { id: "play", label: "Play", enabled: true },
    { id: "textures", label: "Textures", enabled: true },
    { id: "music", label: "Music", enabled: true },
    { id: "introOutro", label: "Intro/Outro", enabled: true },
    { id: "weapons", label: "Weapons", enabled: true },
    { id: "enemies", label: "Enemies", enabled: true },
  ];

  let activeTab = $state<Tab>("map");

  let newWidth = $state(mapStore.map.width);
  let newHeight = $state(mapStore.map.height);

  function createNewMap(): void {
    if (!confirm(`Start a new ${newWidth}x${newHeight} map? Unsaved changes will be lost.`)) return;
    mapStore.newMap(newWidth, newHeight);
  }

  function exportJson(): void {
    const blob = new Blob([JSON.stringify(mapStore.map, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${mapStore.map.name || "map"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSession(): void {
    saveRecentSave(mapStore.map);
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
  <div class="top-panel">
    <div class="brand-group">
      <span class="brand">Blopple</span>
      <div class="divider"></div>
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
    </div>

    <div class="doc-actions">
      <input class="dim" type="number" min="8" max="256" bind:value={newWidth} />
      <span class="x">x</span>
      <input class="dim" type="number" min="8" max="256" bind:value={newHeight} />
      <button onclick={createNewMap}>New Map</button>
      <div class="divider"></div>
      <button onclick={() => (showExport = true)}>Export</button>
      <label class="import">
        Import
        <input type="file" accept="application/json" onchange={importMap} />
      </label>
      <div class="divider"></div>
      <button class="help" title="Show welcome guide" aria-label="Help" onclick={() => (showWelcome = true)}>?</button>
    </div>
  </div>

  {#if showWelcome}
    <WelcomeModal onClose={dismissWelcome} onOpenRecentSaves={openRecentSaves} />
  {/if}

  {#if showRecentSaves}
    <RecentSavesModal onClose={() => (showRecentSaves = false)} onLoad={loadRecentSave} />
  {/if}

  {#if showExport}
    <ExportModal onClose={() => (showExport = false)} onExportJson={exportJson} onExportSession={exportSession} />
  {/if}

  <div class="workspace">
    {#if activeTab === "map"}
      <Toolbar />
      <div class="stage canvas-well">
        <MapGrid />
      </div>
    {:else if activeTab === "preview"}
      <div class="stage canvas-well">
        <MapPreview3D />
      </div>
    {:else if activeTab === "play"}
      <div class="stage canvas-well">
        <PlayTest />
      </div>
    {:else if activeTab === "textures"}
      <div class="stage-flex">
        <TextureEditor />
      </div>
    {:else if activeTab === "music"}
      <div class="stage-flex">
        <MusicEditor />
      </div>
    {:else if activeTab === "introOutro"}
      <div class="stage-flex">
        <IntroOutroEditor />
      </div>
    {:else if activeTab === "weapons"}
      <div class="stage-flex">
        <WeaponEditor />
      </div>
    {:else if activeTab === "enemies"}
      <div class="stage-flex">
        <EnemyEditor />
      </div>
    {/if}
  </div>
</main>

<style>
  :global(:root) {
    --bg-void: #0d0d0f;
    --bg-chrome: #1a1a1e;
    --bg-panel: #1e1e22;
    --bg-control: #29292f;
    --bg-control-hover: #34343c;
    --border: #404046;
    --border-light: #55555e;
    --text: #eaeaee;
    --text-dim: #888891;
    --accent: #e0913a;
    --accent-dim: #8a5a24;
    --accent-glow: rgba(224, 145, 58, 0.18);
  }
  :global(body) {
    margin: 0;
    background: var(--bg-void);
    color: var(--text);
    font-family: monospace;
  }
  main {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  .top-panel {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    padding: 0.4rem 0.6rem;
    background: var(--bg-chrome);
    border-bottom: 1px solid var(--border);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.03);
  }
  .brand-group,
  .tabs,
  .doc-actions {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  .brand-group {
    gap: 0.75rem;
  }
  .brand {
    color: var(--accent);
    font-weight: bold;
    letter-spacing: 0.04em;
    padding: 0 0.3rem;
  }
  .divider {
    width: 1px;
    align-self: stretch;
    background: var(--border);
    margin: 0 0.15rem;
  }
  button {
    background: var(--bg-control);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 2px;
    box-shadow: inset 0 1px 0 var(--border-light);
    padding: 0.3rem 0.6rem;
    cursor: pointer;
    font: inherit;
  }
  button:hover:not(:disabled) {
    background: var(--bg-control-hover);
  }
  .tabs button.active {
    color: var(--accent);
    background: var(--accent-glow);
    border-color: var(--accent-dim);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.45);
  }
  button:disabled {
    color: #55555a;
    cursor: not-allowed;
    box-shadow: none;
  }
  .x {
    color: var(--text-dim);
  }
  .help {
    width: 1.7rem;
    height: 1.7rem;
    padding: 0;
    border-radius: 50%;
    text-align: center;
    color: var(--text-dim);
  }
  .help:hover {
    color: var(--text);
  }
  .dim {
    width: 3.5rem;
    background: var(--bg-control);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 0.3rem;
    font: inherit;
  }
  .import {
    position: relative;
    overflow: hidden;
    background: var(--bg-control);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 2px;
    box-shadow: inset 0 1px 0 var(--border-light);
    padding: 0.3rem 0.6rem;
    cursor: pointer;
  }
  .import:hover {
    background: var(--bg-control-hover);
  }
  .import input {
    position: absolute;
    inset: 0;
    opacity: 0;
    cursor: pointer;
  }
  .workspace {
    flex: 1;
    display: flex;
    min-height: 0;
  }
  .stage {
    flex: 1;
    min-width: 0;
    overflow: auto;
  }
  .stage-flex {
    flex: 1;
    min-width: 0;
    min-height: 0;
    display: flex;
  }
  .canvas-well {
    background: var(--bg-void);
    box-shadow: inset 0 0 0 1px var(--border), inset 0 2px 8px rgba(0, 0, 0, 0.5);
    padding: 1rem;
  }
</style>
