<script lang="ts">
  import type { SfxDef } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import { previewSfx } from "../lib/synth";
  import InstrumentControls from "./InstrumentControls.svelte";

  const categories: SfxDef["category"][] = ["weapon", "enemy", "other"];

  let editingId = $state<string | null>(mapStore.map.sfx[0]?.id ?? null);
  let newCategory = $state<SfxDef["category"]>("weapon");

  const editing = $derived(editingId ? mapStore.sfxAt(editingId) : undefined);

  function newSfx(): void {
    const sfx = mapStore.addSfx(newCategory);
    editingId = sfx.id;
  }

  function duplicateSfx(): void {
    if (!editingId) return;
    const sfx = mapStore.duplicateSfx(editingId);
    if (sfx) editingId = sfx.id;
  }

  function deleteSfx(): void {
    if (!editingId) return;
    if (!confirm("Delete this sound effect?")) return;
    mapStore.removeSfx(editingId);
    editingId = mapStore.map.sfx[0]?.id ?? null;
  }

  function addLayer(): void {
    if (editingId) mapStore.addSfxLayer(editingId);
  }

  function duplicateLayer(layerId: string): void {
    if (editingId) mapStore.duplicateSfxLayer(editingId, layerId);
  }

  function removeLayer(layerId: string): void {
    if (editingId) mapStore.removeSfxLayer(editingId, layerId);
  }
</script>

<div class="sfx-editor">
  <div class="sidebar">
    <div class="add-row">
      <select bind:value={newCategory}>
        {#each categories as c (c)}
          <option value={c}>{c}</option>
        {/each}
      </select>
      <button onclick={newSfx}>New</button>
    </div>
    <div class="sidebar-actions">
      <button onclick={duplicateSfx} disabled={!editingId}>Duplicate</button>
      <button onclick={deleteSfx} disabled={!editingId}>Delete</button>
    </div>
    <div class="list">
      {#each mapStore.map.sfx as s (s.id)}
        <button class="list-item" class:active={editingId === s.id} onclick={() => (editingId = s.id)}>
          <span class="category">{s.category}</span>
          <span>{s.name}</span>
        </button>
      {/each}
      {#if mapStore.map.sfx.length === 0}
        <p class="hint">No sound effects yet. Click "New" to start one.</p>
      {/if}
    </div>
  </div>

  <div class="main-pane">
    {#if editing}
      <div class="header-row">
        <input class="name" type="text" bind:value={editing.name} />
        <button onclick={() => previewSfx(editing)}>▶ Preview all</button>
      </div>
      <label class="category-select">
        Category
        <select bind:value={editing.category}>
          {#each categories as c (c)}
            <option value={c}>{c}</option>
          {/each}
        </select>
      </label>

      <div class="layers">
        {#each editing.layers as layer (layer.id)}
          <div class="layer">
            <div class="layer-header">
              <label class="note-select">
                Note
                <input type="range" min="-24" max="24" step="1" bind:value={layer.note} />
                <span>{layer.note}</span>
              </label>
              <label class="note-select">
                Delay
                <input type="range" min="0" max="1" step="0.01" bind:value={layer.delay} />
                <span>{layer.delay.toFixed(2)}s</span>
              </label>
              <label class="note-select">
                Gain
                <input type="range" min="0" max="1" step="0.01" bind:value={layer.gain} />
              </label>
              <div class="layer-actions">
                <button onclick={() => duplicateLayer(layer.id)}>Duplicate</button>
                <button onclick={() => removeLayer(layer.id)} disabled={editing.layers.length <= 1}>Remove</button>
              </div>
            </div>
            <InstrumentControls instrument={layer.instrument} note={layer.note} />
          </div>
        {/each}
      </div>
      <button onclick={addLayer}>+ Add layer</button>
    {:else}
      <p class="hint">Select or create a sound effect to edit it.</p>
    {/if}
  </div>
</div>

<style>
  .sfx-editor {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .sidebar {
    width: 16rem;
    display: flex;
    flex-direction: column;
    border-right: 1px solid #444;
    padding: 0.5rem;
    gap: 0.5rem;
    overflow-y: auto;
  }
  .sidebar-actions {
    display: flex;
    gap: 0.25rem;
  }
  .sidebar-actions button {
    flex: 1;
  }
  .add-row {
    display: flex;
    gap: 0.25rem;
  }
  .add-row select {
    flex: 1;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .list-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-align: left;
    overflow: hidden;
  }
  .list-item span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .category {
    font-size: 0.75em;
    color: #888;
    text-transform: uppercase;
    flex-shrink: 0;
  }
  .main-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    overflow: auto;
    align-items: flex-start;
  }
  .header-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .name {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
    width: 16rem;
  }
  .category-select,
  .note-select {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9em;
    color: #bbb;
  }
  .layers {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    width: 100%;
  }
  .layer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    border: 1px solid #444;
    padding: 0.6rem;
    background: #262626;
  }
  .layer-header {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .layer-actions {
    display: flex;
    gap: 0.25rem;
    margin-left: auto;
  }
  select {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
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
  .hint {
    color: #888;
    font-size: 0.9em;
  }
</style>
