<script lang="ts">
  const { onClose }: { onClose: () => void } = $props();
</script>

<div class="modal-backdrop">
  <div class="modal">
    <span class="brand">Blopple</span>

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

    <button class="dismiss" onclick={onClose}>Got it</button>
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
  .brand {
    color: var(--accent);
    font-weight: bold;
    letter-spacing: 0.04em;
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
