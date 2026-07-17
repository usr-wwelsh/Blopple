<script lang="ts">
  import type { AudioTrackDef } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import { previewAudioTrack, stopAudioPreview } from "../lib/synth";
  import { encodeAudioFile, SIZE_TARGET_PRESETS } from "../lib/audioImport";

  let fileInput = $state<HTMLInputElement>();
  let targetJsonBytes = $state(SIZE_TARGET_PRESETS[0].targetJsonBytes);
  let encoding = $state(false);
  let progress = $state(0);
  let error = $state<string | null>(null);
  let playingId = $state<string | null>(null);

  function importAudio(): void {
    fileInput?.click();
  }

  async function onImportFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    error = null;
    encoding = true;
    progress = 0;
    try {
      const dataUrl = await encodeAudioFile(file, targetJsonBytes, (f) => (progress = f));
      mapStore.addAudioTrack(file.name.replace(/\.[^.]+$/, ""), dataUrl);
    } catch (err) {
      error = err instanceof Error ? err.message : "Failed to import audio.";
    } finally {
      encoding = false;
    }
  }

  function renameTrack(track: AudioTrackDef, e: Event): void {
    mapStore.renameAudioTrack(track.id, (e.target as HTMLInputElement).value);
  }

  function deleteTrack(track: AudioTrackDef): void {
    if (!confirm(`Delete "${track.name}"? Levels using it will lose their music.`)) return;
    if (playingId === track.id) stopPreview();
    mapStore.removeAudioTrack(track.id);
  }

  function togglePreview(track: AudioTrackDef): void {
    if (playingId === track.id) {
      stopPreview();
      return;
    }
    previewAudioTrack(track, () => (playingId = null));
    playingId = track.id;
  }

  function stopPreview(): void {
    stopAudioPreview();
    playingId = null;
  }

  function sizeLabel(dataUrl: string): string {
    const kb = (dataUrl.length * 0.75) / 1024;
    return kb > 1024 ? `${(kb / 1024).toFixed(2)} MB` : `${kb.toFixed(0)} KB`;
  }
</script>

<div class="audio-track-editor">
  <div class="import-row">
    <select bind:value={targetJsonBytes} disabled={encoding}>
      {#each SIZE_TARGET_PRESETS as p (p.targetJsonBytes)}
        <option value={p.targetJsonBytes}>{p.label}</option>
      {/each}
    </select>
    <button onclick={importAudio} disabled={encoding}>{encoding ? "Encoding…" : "Import audio"}</button>
    <input bind:this={fileInput} class="file-input" type="file" accept="audio/*" onchange={onImportFile} />
    {#if encoding}
      <span class="progress">{Math.round(progress * 100)}%</span>
    {/if}
  </div>
  {#if error}
    <p class="error">{error}</p>
  {/if}

  <div class="list">
    {#each mapStore.map.audioTracks as t (t.id)}
      <div class="list-item">
        <button class="play" onclick={() => togglePreview(t)}>{playingId === t.id ? "■" : "▶"}</button>
        <input class="name" type="text" value={t.name} oninput={(e) => renameTrack(t, e)} />
        <span class="size">{sizeLabel(t.dataUrl)}</span>
        <button class="delete" onclick={() => deleteTrack(t)}>Delete</button>
      </div>
    {/each}
    {#if mapStore.map.audioTracks.length === 0}
      <p class="hint">No imported audio yet. Pick a target size and click "Import audio" to add a song.</p>
    {/if}
  </div>
</div>

<style>
  .audio-track-editor {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    overflow-y: auto;
    min-height: 0;
  }
  .import-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
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
  button:disabled {
    color: #555;
    cursor: not-allowed;
  }
  .file-input {
    display: none;
  }
  .progress {
    color: #bbb;
    font-size: 0.9em;
  }
  .error {
    color: #e77;
    font-size: 0.9em;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .list-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .play {
    width: 2rem;
    padding: 0.3rem 0;
  }
  .name {
    flex: 1;
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
    min-width: 0;
  }
  .size {
    color: #888;
    font-size: 0.85em;
    width: 4.5rem;
    text-align: right;
  }
  .hint {
    color: #888;
    font-size: 0.9em;
  }
</style>
