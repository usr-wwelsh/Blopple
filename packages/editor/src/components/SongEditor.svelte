<script lang="ts">
  import { mapStore } from "../lib/mapStore.svelte";
  import { INSTRUMENT_PRESETS } from "../lib/musicPresets";
  import { SongPlayer, noteName } from "../lib/synth";
  import InstrumentControls from "./InstrumentControls.svelte";

  const MAX_NOTE = 24;
  const MIN_NOTE = -24;

  let editingSongId = $state<string | null>(mapStore.map.songs[0]?.id ?? null);
  let editingPatternId = $state<string | null>(null);
  let selectedPreset = $state(INSTRUMENT_PRESETS[0].label);
  let addToOrderId = $state<string>("");
  let playing = $state(false);
  let currentStep = $state<{ order: number; step: number } | null>(null);

  const song = $derived(editingSongId ? mapStore.songAt(editingSongId) : undefined);
  const pattern = $derived(song && editingPatternId ? song.patterns.find((p) => p.id === editingPatternId) : undefined);

  let player: SongPlayer | undefined;

  $effect(() => {
    const s = song;
    player?.stop();
    playing = false;
    currentStep = null;
    player = s ? new SongPlayer(s) : undefined;
    if (player) {
      player.onStep = (order, step) => (currentStep = { order, step });
    }
    if (s && (!editingPatternId || !s.patterns.some((p) => p.id === editingPatternId))) {
      editingPatternId = s.patterns[0]?.id ?? null;
    }
    return () => player?.stop();
  });

  function newSong(): void {
    const s = mapStore.addSong();
    editingSongId = s.id;
  }

  function duplicateSong(): void {
    if (!editingSongId) return;
    const s = mapStore.duplicateSong(editingSongId);
    if (s) editingSongId = s.id;
  }

  function deleteSong(): void {
    if (!editingSongId) return;
    if (!confirm("Delete this song?")) return;
    mapStore.removeSong(editingSongId);
    editingSongId = mapStore.map.songs[0]?.id ?? null;
  }

  function addInstrument(): void {
    if (!editingSongId) return;
    mapStore.addInstrument(editingSongId, selectedPreset);
  }

  function removeInstrument(index: number): void {
    if (!editingSongId) return;
    mapStore.removeInstrument(editingSongId, index);
  }

  function newPattern(): void {
    if (!editingSongId) return;
    const p = mapStore.addPattern(editingSongId);
    if (p) editingPatternId = p.id;
  }

  function duplicatePattern(): void {
    if (!editingSongId || !editingPatternId) return;
    const p = mapStore.duplicatePattern(editingSongId, editingPatternId);
    if (p) editingPatternId = p.id;
  }

  function deletePattern(): void {
    if (!editingSongId || !editingPatternId) return;
    const id = editingPatternId;
    editingPatternId = null;
    mapStore.removePattern(editingSongId, id);
  }

  function toggleStep(row: number, step: number): void {
    if (!pattern) return;
    pattern.rows[row][step] = pattern.rows[row][step] >= 0 ? -1 : 0;
  }

  function scrollStep(row: number, step: number, e: WheelEvent): void {
    if (!pattern) return;
    e.preventDefault();
    const delta = e.deltaY < 0 ? 1 : -1;
    const current = pattern.rows[row][step];
    const base = current < 0 ? 0 : current;
    pattern.rows[row][step] = Math.max(MIN_NOTE, Math.min(MAX_NOTE, base + delta));
  }

  function transposeRow(row: number, delta: number): void {
    if (!pattern) return;
    pattern.rows[row] = pattern.rows[row].map((n) => (n < 0 ? n : Math.max(MIN_NOTE, Math.min(MAX_NOTE, n + delta))));
  }

  function addToOrder(): void {
    if (!song || !addToOrderId) return;
    song.order.push(addToOrderId);
  }

  function removeFromOrder(index: number): void {
    song?.order.splice(index, 1);
  }

  function moveOrder(index: number, delta: number): void {
    if (!song) return;
    const target = index + delta;
    if (target < 0 || target >= song.order.length) return;
    const [item] = song.order.splice(index, 1);
    song.order.splice(target, 0, item);
  }

  function patternName(id: string): string {
    return song?.patterns.find((p) => p.id === id)?.name ?? "?";
  }

  function togglePlay(): void {
    if (!player) return;
    if (playing) {
      player.stop();
      playing = false;
      currentStep = null;
    } else {
      player.start();
      playing = true;
    }
  }
</script>

<div class="song-editor">
  <div class="sidebar">
    <div class="sidebar-actions">
      <button onclick={newSong}>New</button>
      <button onclick={duplicateSong} disabled={!editingSongId}>Duplicate</button>
      <button onclick={deleteSong} disabled={!editingSongId}>Delete</button>
    </div>
    <div class="list">
      {#each mapStore.map.songs as s (s.id)}
        <button class="list-item" class:active={editingSongId === s.id} onclick={() => (editingSongId = s.id)}>
          <span>{s.name}</span>
        </button>
      {/each}
      {#if mapStore.map.songs.length === 0}
        <p class="hint">No songs yet. Click "New" to start one.</p>
      {/if}
    </div>
  </div>

  <div class="main-pane">
    {#if song}
      <div class="transport">
        <input class="name" type="text" bind:value={song.name} />
        <label>
          BPM
          <input class="bpm" type="number" min="40" max="300" bind:value={song.bpm} />
        </label>
        <button onclick={togglePlay}>{playing ? "⏹ Stop" : "▶ Play Song"}</button>
      </div>

      <section>
        <h3>Instruments</h3>
        <div class="add-row">
          <select bind:value={selectedPreset}>
            {#each INSTRUMENT_PRESETS as p (p.label)}
              <option value={p.label}>{p.label}</option>
            {/each}
          </select>
          <button onclick={addInstrument}>Add Instrument</button>
        </div>
        <div class="instrument-list">
          {#each song.instruments as inst, i (i)}
            <div class="instrument-item">
              <InstrumentControls instrument={inst} />
              <button onclick={() => removeInstrument(i)}>Remove</button>
            </div>
          {/each}
          {#if song.instruments.length === 0}
            <p class="hint">Add an instrument to start a pattern.</p>
          {/if}
        </div>
      </section>

      <section>
        <h3>Patterns</h3>
        <div class="pattern-tabs">
          {#each song.patterns as p (p.id)}
            <button class:active={editingPatternId === p.id} onclick={() => (editingPatternId = p.id)}>{p.name}</button>
          {/each}
          <button onclick={newPattern}>+ New</button>
          <button onclick={duplicatePattern} disabled={!editingPatternId}>Duplicate</button>
          <button onclick={deletePattern} disabled={!editingPatternId}>Delete</button>
        </div>

        {#if pattern}
          <input class="name" type="text" bind:value={pattern.name} />
          <div class="grid">
            {#each song.instruments as inst, row (row)}
              <div class="grid-row">
                <div class="row-label">
                  <span>{inst.name}</span>
                  {#if inst.kind !== "drum"}
                    <button class="mini" onclick={() => transposeRow(row, 1)}>▲</button>
                    <button class="mini" onclick={() => transposeRow(row, -1)}>▼</button>
                  {/if}
                </div>
                <div class="steps">
                  {#each pattern.rows[row] as note, step (step)}
                    <button
                      class="step"
                      class:on={note >= 0}
                      class:beat={step % 4 === 0}
                      class:playhead={currentStep?.step === step && song.order[currentStep.order] === pattern.id}
                      onclick={() => toggleStep(row, step)}
                      onwheel={inst.kind === "drum" ? undefined : (e) => scrollStep(row, step, e)}
                      title={note >= 0 ? (inst.kind === "drum" ? "hit" : `${noteName(note)} — scroll to bend pitch`) : "rest"}
                    >{note >= 0 && inst.kind !== "drum" ? noteName(note) : ""}</button>
                  {/each}
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <p class="hint">No pattern selected. Click "+ New" to create one.</p>
        {/if}
      </section>

      <section>
        <h3>Arrangement</h3>
        <div class="order-row">
          {#each song.order as patternId, i (i)}
            <div class="chip" class:playhead={playing && currentStep?.order === i}>
              <span>{patternName(patternId)}</span>
              <button class="mini" onclick={() => moveOrder(i, -1)} disabled={i === 0}>◀</button>
              <button class="mini" onclick={() => moveOrder(i, 1)} disabled={i === song.order.length - 1}>▶</button>
              <button class="mini" onclick={() => removeFromOrder(i)}>✕</button>
            </div>
          {/each}
          {#if song.order.length === 0}
            <p class="hint">No arrangement yet — add a pattern below.</p>
          {/if}
        </div>
        <div class="add-row">
          <select bind:value={addToOrderId}>
            <option value="" disabled>select pattern</option>
            {#each song.patterns as p (p.id)}
              <option value={p.id}>{p.name}</option>
            {/each}
          </select>
          <button onclick={addToOrder} disabled={!addToOrderId}>Add to Arrangement</button>
        </div>
      </section>
    {:else}
      <p class="hint">Select or create a song to start composing.</p>
    {/if}
  </div>
</div>

<style>
  .song-editor {
    display: flex;
    flex: 1;
    min-height: 0;
  }
  .sidebar {
    width: 14rem;
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
  .list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .list-item {
    text-align: left;
  }
  .main-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    overflow: auto;
  }
  .transport {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  .transport label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.9em;
    color: #bbb;
  }
  .bpm {
    width: 4rem;
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
  }
  .name {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
    width: 16rem;
  }
  section {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  h3 {
    margin: 0;
    font-size: 1em;
    color: #ccc;
    border-bottom: 1px solid #333;
    padding-bottom: 0.25rem;
  }
  .add-row {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }
  .instrument-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .instrument-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    border: 1px solid #333;
    padding: 0.5rem;
  }
  .pattern-tabs {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
  }
  .grid {
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-x: auto;
  }
  .grid-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .row-label {
    width: 9rem;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.15rem;
    font-size: 0.85em;
    overflow: hidden;
  }
  .row-label span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }
  .steps {
    display: flex;
    gap: 2px;
  }
  .step {
    width: 2.4rem;
    height: 1.6rem;
    padding: 0;
    background: #222;
    border: 1px solid #333;
    font-size: 0.65em;
    color: #cde;
    cursor: ns-resize;
  }
  .step.beat {
    background: #2a2a2a;
  }
  .step.on {
    background: #2980b9;
    border-color: #5dade2;
  }
  .step.playhead {
    outline: 2px solid #f1c40f;
    outline-offset: -2px;
  }
  .order-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: #2a2a2a;
    border: 1px solid #444;
    padding: 0.25rem 0.5rem;
  }
  .chip.playhead {
    border-color: #f1c40f;
  }
  button,
  select,
  .mini {
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
  .mini {
    padding: 0.1rem 0.3rem;
    font-size: 0.75em;
  }
  .hint {
    color: #888;
    font-size: 0.9em;
  }
</style>
