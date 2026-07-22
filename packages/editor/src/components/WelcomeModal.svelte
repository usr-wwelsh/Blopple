<script lang="ts">
  const {
    onStartFresh,
    onOpenRecentSaves,
    onImport,
    onDismiss,
  }: {
    onStartFresh: () => void;
    onOpenRecentSaves: () => void;
    onImport: (e: Event) => void;
    onDismiss: () => void;
  } = $props();
</script>

<div class="modal-backdrop">
  <div class="modal">
    <div class="header">
      <span class="brand">Blopple</span>
      <button class="dismiss" aria-label="Close" onclick={onDismiss}>&times;</button>
    </div>

    <div class="controls">
      <div class="control highlight">
        <span class="key">Right-click drag</span>
        <span class="desc">Pan around the canvas</span>
      </div>
      <div class="control">
        <span class="key">Scroll wheel</span>
        <span class="desc">Zoom in and out</span>
      </div>
    </div>

    <div class="actions">
      <button class="start-fresh" onclick={onStartFresh}>Start Fresh</button>
      <button class="load-recent" onclick={onOpenRecentSaves}>Load Recent Save</button>
      <label class="import">
        Import
        <input type="file" accept="application/json" onchange={onImport} />
      </label>
    </div>
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
    z-index: 1000;
  }
  .modal {
    width: 22rem;
    max-width: calc(100vw - 2rem);
    background: var(--bg-panel);
    border: 1px solid var(--border);
    border-radius: 3px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 1.25rem;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
  }
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand {
    color: var(--accent);
    font-weight: bold;
    letter-spacing: 0.04em;
  }
  .dismiss {
    background: transparent;
    color: var(--text-dim);
    border: none;
    font-size: 1.3em;
    line-height: 1;
    padding: 0;
    cursor: pointer;
  }
  .dismiss:hover {
    color: var(--text);
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .control {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg-void);
    border: 1px solid var(--border);
    border-radius: 2px;
  }
  .control.highlight {
    border-color: var(--accent-dim);
    box-shadow: inset 0 0 0 1px var(--accent-glow);
  }
  .key {
    color: var(--text);
    font-size: 0.95em;
    font-weight: bold;
  }
  .control.highlight .key {
    color: var(--accent);
  }
  .desc {
    color: var(--text-dim);
    font-size: 0.85em;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
  .start-fresh,
  .load-recent {
    background: var(--bg-control);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 2px;
    box-shadow: inset 0 1px 0 var(--border-light);
    padding: 0.35rem 0.9rem;
    cursor: pointer;
    font: inherit;
  }
  .start-fresh:hover,
  .load-recent:hover {
    background: var(--bg-control-hover);
  }
  .import {
    position: relative;
    overflow: hidden;
    background: var(--bg-control);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 2px;
    box-shadow: inset 0 1px 0 var(--border-light);
    padding: 0.35rem 0.9rem;
    cursor: pointer;
    font: inherit;
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
</style>
