<script lang="ts">
  import { parseTextureRef } from "@blopple/shared";
  import { PALETTE } from "../lib/color";
  import { mapStore } from "../lib/mapStore.svelte";
  import TextureThumb from "./TextureThumb.svelte";

  let { value, onChange }: { value: string | null; onChange: (ref: string | null) => void } = $props();

  const parsed = $derived(parseTextureRef(value));
  // null until the user manually picks a tab — lets "none" clear the value without
  // yanking you out of whichever tab (color/texture) you were browsing
  let modeOverride = $state<"color" | "texture" | null>(null);
  const mode = $derived(modeOverride ?? (parsed?.kind === "texture" ? "texture" : "color"));
</script>

<div class="picker">
  <div class="mode-row">
    <button class="chip" class:active={mode === "color"} onclick={() => (modeOverride = "color")}>Color</button>
    <button class="chip" class:active={mode === "texture"} onclick={() => (modeOverride = "texture")}>Texture</button>
  </div>

  {#if mode === "color"}
    <div class="grid">
      <button class="swatch none" class:active={!value} onclick={() => onChange(null)} aria-label="none">none</button>
      {#each PALETTE as c (c)}
        <button
          class="swatch"
          class:active={parsed?.kind === "color" && parsed.color === c}
          style="background:{c}"
          onclick={() => onChange(`color:${c}`)}
          aria-label={c}
        ></button>
      {/each}
    </div>
  {:else}
    <div class="grid">
      <button class="swatch none" class:active={!value} onclick={() => onChange(null)} aria-label="none">none</button>
      {#each mapStore.map.textures as t (t.id)}
        <button
          class="swatch tex"
          class:active={parsed?.kind === "texture" && parsed.id === t.id}
          onclick={() => onChange(`texture:${t.id}`)}
          aria-label={t.name}
        >
          <TextureThumb texture={t} size={28} />
        </button>
      {/each}
      {#if mapStore.map.textures.length === 0}
        <span class="hint">no textures yet — paint one in the Textures tab</span>
      {/if}
    </div>
  {/if}
</div>

<style>
  .picker {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }
  .mode-row {
    display: flex;
    gap: 0.25rem;
  }
  .chip {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.8em;
  }
  .chip.active {
    background: #555;
    border-color: #888;
  }
  .grid {
    display: flex;
    gap: 0.25rem;
    flex-wrap: wrap;
    max-width: 16rem;
  }
  .swatch {
    width: 28px;
    height: 28px;
    padding: 0;
    border: 2px solid #444;
    cursor: pointer;
  }
  .swatch.active {
    border-color: #e0913a;
  }
  .swatch.none {
    width: auto;
    padding: 0 0.35rem;
    font-size: 0.65em;
    color: #888;
    background: #2a2a2a;
  }
  .swatch.tex {
    padding: 2px;
    background: #2a2a2a;
  }
  .hint {
    color: #888;
    font-size: 0.85em;
  }
</style>
