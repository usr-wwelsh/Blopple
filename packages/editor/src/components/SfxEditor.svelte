<script lang="ts">
  import type { SfxDef } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import { previewInstrument } from "../lib/synth";
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
      <input class="name" type="text" bind:value={editing.name} />
      <label class="category-select">
        Category
        <select bind:value={editing.category}>
          {#each categories as c (c)}
            <option value={c}>{c}</option>
          {/each}
        </select>
      </label>
      <label class="note-select">
        Note
        <input type="range" min="-24" max="24" step="1" bind:value={editing.note} />
        <span>{editing.note}</span>
      </label>
      <InstrumentControls instrument={editing.instrument} note={editing.note} />
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
