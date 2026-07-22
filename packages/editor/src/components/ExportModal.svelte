<script lang="ts">
  const {
    onClose,
    onExportJson,
    onExportSession,
    onExportHtml,
  }: { onClose: () => void; onExportJson: () => void; onExportSession: () => void; onExportHtml: () => void } = $props();

  function handle(action: () => void): void {
    action();
    onClose();
  }
</script>

<div class="modal-backdrop">
  <div class="modal">
    <span class="brand">Export</span>

    <div class="options">
      <button class="option" onclick={() => handle(onExportJson)}>
        <span class="label">JSON File</span>
        <span class="desc">Download a .json file to disk</span>
      </button>
      <button class="option" onclick={() => handle(onExportSession)}>
        <span class="label">Session</span>
        <span class="desc">Save into Recent Saves for later</span>
      </button>
      <button class="option" onclick={() => handle(onExportHtml)}>
        <span class="label">HTML</span>
        <span class="desc">Standalone playable page — .html file</span>
      </button>
    </div>

    <button class="dismiss" onclick={onClose}>Cancel</button>
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
  .options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .option {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    padding: 0.6rem 0.75rem;
    background: var(--bg-void);
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .option:hover:not(:disabled) {
    background: var(--bg-control-hover);
  }
  .option:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
  .label {
    color: var(--text);
    font-size: 0.95em;
    font-weight: bold;
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
