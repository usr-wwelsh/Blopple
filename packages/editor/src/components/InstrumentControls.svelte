<script lang="ts">
  import type { Instrument, InstrumentKind, Waveform, DrumType } from "@blopple/shared";
  import { previewInstrument } from "../lib/synth";

  let { instrument, note = 0 }: { instrument: Instrument; note?: number } = $props();

  const kinds: InstrumentKind[] = ["synth", "string", "brass", "drum"];
  const waveforms: Waveform[] = ["square", "sawtooth", "triangle"];
  const drumTypes: DrumType[] = ["kick", "snare", "hihat", "clap"];
</script>

<div class="instrument-controls">
  <div class="row">
    <input class="name" type="text" bind:value={instrument.name} />
    <button onclick={() => previewInstrument(instrument, note)}>▶ Preview</button>
  </div>
  <div class="row">
    <label>
      Kind
      <select bind:value={instrument.kind}>
        {#each kinds as k (k)}
          <option value={k}>{k}</option>
        {/each}
      </select>
    </label>
    {#if instrument.kind === "drum"}
      <label>
        Drum
        <select bind:value={instrument.drumType}>
          {#each drumTypes as d (d)}
            <option value={d}>{d}</option>
          {/each}
        </select>
      </label>
    {:else}
      <label>
        Wave
        <select bind:value={instrument.waveform}>
          {#each waveforms as w (w)}
            <option value={w}>{w}</option>
          {/each}
        </select>
      </label>
    {/if}
    <label>
      Vol
      <input type="range" min="0" max="1" step="0.01" bind:value={instrument.volume} />
    </label>
  </div>
  {#if instrument.kind !== "drum"}
    <div class="row">
      <label>
        Attack
        <input type="range" min="0" max="1" step="0.01" bind:value={instrument.attack} />
      </label>
      <label>
        Decay
        <input type="range" min="0" max="1" step="0.01" bind:value={instrument.decay} />
      </label>
      <label>
        Sustain
        <input type="range" min="0" max="1" step="0.01" bind:value={instrument.sustain} />
      </label>
      <label>
        Release
        <input type="range" min="0" max="2" step="0.01" bind:value={instrument.release} />
      </label>
    </div>
  {/if}
</div>

<style>
  .instrument-controls {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .row {
    display: flex;
    gap: 0.6rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .name {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
    width: 12rem;
  }
  label {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.85em;
    color: #bbb;
  }
  select {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.2rem;
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
</style>
