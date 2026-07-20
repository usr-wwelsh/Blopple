<script lang="ts">
  import { parseTextureRef } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import TextureThumb from "./TextureThumb.svelte";

  let editingId = $state<string | null>(mapStore.map.enemyDefs[0]?.id ?? null);
  const editing = $derived(editingId ? mapStore.enemyAt(editingId) : undefined);

  function newEnemy(): void {
    const enemy = mapStore.addEnemy();
    editingId = enemy.id;
  }

  function duplicateEnemy(): void {
    if (!editingId) return;
    const enemy = mapStore.duplicateEnemy(editingId);
    if (enemy) editingId = enemy.id;
  }

  function deleteEnemy(): void {
    if (!editingId) return;
    if (!confirm("Delete this enemy?")) return;
    mapStore.removeEnemy(editingId);
    editingId = mapStore.map.enemyDefs[0]?.id ?? null;
  }

  function spriteRefId(ref: string | null): string | null {
    const parsed = parseTextureRef(ref);
    return parsed?.kind === "texture" ? parsed.id : null;
  }
</script>

<div class="enemy-editor">
  <div class="sidebar">
    <div class="sidebar-actions">
      <button onclick={newEnemy}>New</button>
      <button onclick={duplicateEnemy} disabled={!editingId}>Duplicate</button>
      <button onclick={deleteEnemy} disabled={!editingId}>Delete</button>
    </div>
    <div class="list">
      {#each mapStore.map.enemyDefs as e (e.id)}
        <button class="list-item" class:active={editingId === e.id} onclick={() => (editingId = e.id)}>
          {e.name}
        </button>
      {/each}
      {#if mapStore.map.enemyDefs.length === 0}
        <p class="hint">No enemies yet. Click "New" to create one.</p>
      {/if}
    </div>
  </div>

  <div class="main-pane">
    {#if editing}
      <input class="name" type="text" bind:value={editing.name} />

      <label class="row">
        Health
        <input type="number" min="1" bind:value={editing.health} />
      </label>
      <label class="row">
        Speed (cells/sec)
        <input type="number" min="0.1" step="0.1" bind:value={editing.speed} />
      </label>
      <label class="row">
        Damage
        <input type="number" min="0" bind:value={editing.damage} />
      </label>
      <label class="row">
        Attack range (cells)
        <input type="number" min="0" step="0.5" bind:value={editing.attackRangeCells} />
      </label>
      <label class="row">
        Width (cells)
        <input type="number" min="0.1" step="0.1" bind:value={editing.width} />
      </label>
      <label class="row">
        Height (cells)
        <input type="number" min="0.1" step="0.1" bind:value={editing.height} />
      </label>

      <div class="sprite-picker">
        <span class="section-label">Sprite</span>
        <div class="tex-grid">
          <button
            class="tex-swatch none"
            class:active={!editing.spriteRef}
            onclick={() => editing && (editing.spriteRef = null)}
            aria-label="none"
          >
            none
          </button>
          {#each mapStore.map.textures as t (t.id)}
            <button
              class="tex-swatch"
              class:active={spriteRefId(editing.spriteRef) === t.id}
              onclick={() => editing && (editing.spriteRef = `texture:${t.id}`)}
              aria-label={t.name}
            >
              <TextureThumb texture={t} size={28} />
            </button>
          {/each}
        </div>
        {#if mapStore.map.textures.length === 0}
          <span class="hint">no textures yet — paint one in the Textures tab</span>
        {/if}
      </div>
    {:else}
      <p class="hint">Select or create an enemy to edit it.</p>
    {/if}
  </div>
</div>

<style>
  .enemy-editor {
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
  .section-label {
    color: #888;
    font-size: 0.75em;
    text-transform: uppercase;
  }
  .sidebar-actions {
    display: flex;
    gap: 0.25rem;
  }
  .sidebar-actions button {
    flex: 1;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .list-item {
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9em;
    color: #bbb;
  }
  input,
  select {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
  }
  input[type="number"] {
    width: 6rem;
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
  .sprite-picker {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .tex-grid {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    max-width: 16rem;
  }
  .tex-swatch {
    padding: 2px;
  }
  .tex-swatch.none {
    font-size: 0.7em;
    color: #888;
  }
  .hint {
    color: #888;
    font-size: 0.85em;
  }
</style>
