<script lang="ts">
  import type { WeaponBehavior } from "@blopple/shared";
  import { parseTextureRef } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import TextureThumb from "./TextureThumb.svelte";

  const behaviors: WeaponBehavior[] = ["melee", "hitscan", "projectile"];

  let editingId = $state<string | null>(mapStore.map.weapons[0]?.id ?? null);
  const editing = $derived(editingId ? mapStore.weaponAt(editingId) : undefined);
  const weaponSfx = $derived(mapStore.map.sfx.filter((s) => s.category === "weapon"));

  function newWeapon(): void {
    const weapon = mapStore.addWeapon();
    editingId = weapon.id;
  }

  function duplicateWeapon(): void {
    if (!editingId) return;
    const weapon = mapStore.duplicateWeapon(editingId);
    if (weapon) editingId = weapon.id;
  }

  function deleteWeapon(): void {
    if (!editingId) return;
    if (!confirm("Delete this weapon?")) return;
    mapStore.removeWeapon(editingId);
    editingId = mapStore.map.weapons[0]?.id ?? null;
  }

  function spriteRefId(ref: string | null): string | null {
    const parsed = parseTextureRef(ref);
    return parsed?.kind === "texture" ? parsed.id : null;
  }
</script>

<div class="weapon-editor">
  <div class="sidebar">
    <div class="player-panel">
      <span class="section-label">Player</span>
      <label>
        Health
        <input type="number" min="1" bind:value={mapStore.map.player.health} />
      </label>
      <label>
        Speed
        <input type="number" min="0.1" step="0.1" bind:value={mapStore.map.player.speed} />
      </label>
      <label>
        Starting weapon
        <select bind:value={mapStore.map.player.startingWeaponId}>
          <option value={null}>none</option>
          {#each mapStore.map.weapons as w (w.id)}
            <option value={w.id}>{w.name}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="sidebar-actions">
      <button onclick={newWeapon}>New</button>
      <button onclick={duplicateWeapon} disabled={!editingId}>Duplicate</button>
      <button onclick={deleteWeapon} disabled={!editingId}>Delete</button>
    </div>
    <div class="list">
      {#each mapStore.map.weapons as w (w.id)}
        <button class="list-item" class:active={editingId === w.id} onclick={() => (editingId = w.id)}>
          <span class="category">{w.behavior}</span>
          <span>{w.name}</span>
        </button>
      {/each}
      {#if mapStore.map.weapons.length === 0}
        <p class="hint">No weapons yet. Click "New" to create one.</p>
      {/if}
    </div>
  </div>

  <div class="main-pane">
    {#if editing}
      <input class="name" type="text" bind:value={editing.name} />

      <label class="row">
        Behavior
        <select bind:value={editing.behavior}>
          {#each behaviors as b (b)}
            <option value={b}>{b}</option>
          {/each}
        </select>
      </label>

      <label class="row">
        Damage
        <input type="number" min="0" bind:value={editing.damage} />
      </label>
      <label class="row">
        Fire rate (ms)
        <input type="number" min="1" bind:value={editing.fireRateMs} />
      </label>
      <label class="row">
        Range (cells)
        <input type="number" min="0" step="0.5" bind:value={editing.rangeCells} />
      </label>
      {#if editing.behavior === "projectile"}
        <label class="row">
          Projectile speed (cells/sec)
          <input
            type="number"
            min="0"
            step="0.5"
            value={editing.projectileSpeed ?? 0}
            oninput={(e) => editing && (editing.projectileSpeed = Number((e.target as HTMLInputElement).value))}
          />
        </label>
      {/if}

      <label class="row">
        Fire sound
        <select bind:value={editing.sfxId}>
          <option value={null}>none</option>
          {#each weaponSfx as s (s.id)}
            <option value={s.id}>{s.name}</option>
          {/each}
        </select>
        {#if weaponSfx.length === 0}
          <span class="hint">no weapon sfx yet — add one in the SFX tab</span>
        {/if}
      </label>

      <div class="sprite-pickers">
        {#each [{ label: "Idle sprite", key: "idle" as const }, { label: "Fire sprite", key: "fire" as const }] as slot (slot.key)}
          <div class="sprite-picker">
            <span class="section-label">{slot.label}</span>
            <div class="tex-grid">
              <button
                class="tex-swatch none"
                class:active={!editing.sprites[slot.key]}
                onclick={() => editing && (editing.sprites[slot.key] = null)}
                aria-label="none"
              >
                none
              </button>
              {#each mapStore.map.textures as t (t.id)}
                <button
                  class="tex-swatch"
                  class:active={spriteRefId(editing.sprites[slot.key]) === t.id}
                  onclick={() => editing && (editing.sprites[slot.key] = `texture:${t.id}`)}
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
        {/each}
      </div>
    {:else}
      <p class="hint">Select or create a weapon to edit it.</p>
    {/if}
  </div>
</div>

<style>
  .weapon-editor {
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
  .player-panel {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #444;
  }
  .player-panel label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.85em;
    color: #bbb;
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
  .sprite-pickers {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
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
