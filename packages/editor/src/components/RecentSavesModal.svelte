<script lang="ts">
  import type { MapData } from "@blopple/shared";
  import { listRecentSaves, renameRecentSave, deleteRecentSave, type RecentSave } from "../lib/recentSaves";

  const { onClose, onLoad }: { onClose: () => void; onLoad: (map: MapData) => void } = $props();

  let saves = $state<RecentSave[]>(listRecentSaves());
  let renamingId = $state<string | null>(null);
  let renameValue = $state("");

  function startRename(save: RecentSave): void {
    renamingId = save.id;
    renameValue = save.name;
  }

  function confirmRename(): void {
    if (renamingId) {
      renameRecentSave(renamingId, renameValue.trim() || "untitled");
      saves = listRecentSaves();
    }
    renamingId = null;
  }

  function remove(save: RecentSave): void {
    if (!confirm(`Delete saved session "${save.name}"?`)) return;
    deleteRecentSave(save.id);
    saves = listRecentSaves();
  }

  function formatDate(ts: number): string {
    return new Date(ts).toLocaleString();
  }

  function formatSize(map: MapData): string {
    const bytes = new TextEncoder().encode(JSON.stringify(map)).length;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
</script>

<div class="modal-backdrop">
  <div class="modal">
    <span class="brand">Recent Saves</span>

    {#if saves.length === 0}
      <p class="empty">No saved sessions yet — export a map to create one.</p>
    {:else}
      <ul class="saves">
        {#each saves as save (save.id)}
          <li class="save">
            {#if renamingId === save.id}
              <input
                class="rename-input"
                bind:value={renameValue}
                onkeydown={(e) => e.key === "Enter" && confirmRename()}
                onblur={confirmRename}
              />
            {:else}
              <button class="load" onclick={() => onLoad(save.map)}>
                <span class="name">{save.name}</span>
                <span class="meta">{formatDate(save.savedAt)} · {formatSize(save.map)}</span>
              </button>
            {/if}
            <div class="row-actions">
              <button class="icon" title="Rename" onclick={() => startRename(save)}>✎</button>
              <button class="icon" title="Delete" onclick={() => remove(save)}>✕</button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}

    <button class="dismiss" onclick={onClose}>Close</button>
  </div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1001;
  }
  .modal {
    width: 24rem;
    max-width: calc(100vw - 2rem);
    max-height: calc(100vh - 4rem);
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 3px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .brand {
    color: var(--accent);
    font-weight: bold;
    letter-spacing: 0.04em;
  }
  .empty {
    color: var(--text-dim);
    font-size: 0.9em;
  }
  .saves {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    overflow-y: auto;
  }
  .save {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--bg-void);
    border: 1px solid var(--border);
    border-radius: 2px;
  }
  .load {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.1rem;
    background: none;
    border: none;
    padding: 0.5rem 0.6rem;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .load:hover {
    background: var(--bg-control-hover);
  }
  .name {
    color: var(--text);
    font-weight: bold;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .meta {
    color: var(--text-dim);
    font-size: 0.8em;
  }
  .rename-input {
    flex: 1;
    min-width: 0;
    background: var(--bg-control);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 0.5rem 0.6rem;
    margin: 0.15rem 0 0.15rem 0.15rem;
    font: inherit;
  }
  .row-actions {
    display: flex;
    gap: 0.15rem;
    padding-right: 0.4rem;
  }
  .icon {
    background: var(--bg-control);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 2px;
    box-shadow: inset 0 1px 0 var(--border-light);
    width: 1.6rem;
    height: 1.6rem;
    padding: 0;
    cursor: pointer;
    font: inherit;
  }
  .icon:hover {
    color: var(--text);
    background: var(--bg-control-hover);
  }
  .dismiss {
    align-self: flex-end;
    background: var(--bg-control);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 2px;
    box-shadow: inset 0 1px 0 var(--border-light);
    padding: 0.35rem 0.9rem;
    cursor: pointer;
    font: inherit;
  }
  .dismiss:hover {
    background: var(--bg-control-hover);
  }
</style>
