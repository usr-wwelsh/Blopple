<script lang="ts">
  import { toolStore, type Tool, BRUSH_SIZES } from "../lib/toolStore.svelte";
  import { PALETTE } from "../lib/color";
  import { mapStore } from "../lib/mapStore.svelte";
  import TextureThumb from "./TextureThumb.svelte";

  const tools: { id: Tool; label: string }[] = [
    { id: "wall", label: "Wall" },
    { id: "floor", label: "Floor" },
    { id: "ceiling", label: "Ceiling" },
    { id: "door", label: "Door" },
    { id: "height", label: "Height" },
    { id: "playerStart", label: "Player Start" },
    { id: "erase", label: "Erase" },
  ];
</script>

<div class="toolbar">
  <div class="group">
    {#each tools as t (t.id)}
      <button class:active={toolStore.tool === t.id} onclick={() => (toolStore.tool = t.id)}>
        {t.label}
      </button>
    {/each}
  </div>

  {#if toolStore.tool === "height"}
    <div class="group">
      {#each [0, 1, 2] as h (h)}
        <button class:active={toolStore.height === h} onclick={() => (toolStore.height = h as 0 | 1 | 2)}>
          {h}
        </button>
      {/each}
    </div>
  {/if}

  {#if toolStore.tool === "wall" || toolStore.tool === "floor" || toolStore.tool === "ceiling" || toolStore.tool === "height"}
    <div class="group">
      <button class:active={toolStore.paintMode === "color"} onclick={() => (toolStore.paintMode = "color")}>
        Color
      </button>
      <button class:active={toolStore.paintMode === "texture"} onclick={() => (toolStore.paintMode = "texture")}>
        Texture
      </button>
    </div>

    {#if toolStore.paintMode === "color"}
      <div class="group">
        {#each PALETTE as c (c)}
          <button
            class="swatch"
            class:active={toolStore.color === c}
            style="background:{c}"
            onclick={() => (toolStore.color = c)}
            aria-label={c}
          ></button>
        {/each}
      </div>
    {:else}
      <div class="group">
        {#each mapStore.map.textures as t (t.id)}
          <button
            class="tex-swatch"
            class:active={toolStore.selectedTextureId === t.id}
            onclick={() => (toolStore.selectedTextureId = t.id)}
            aria-label={t.name}
          >
            <TextureThumb texture={t} size={24} />
          </button>
        {/each}
        {#if mapStore.map.textures.length === 0}
          <span class="label">no textures yet — paint one in the Textures tab</span>
        {/if}
      </div>
    {/if}
  {/if}

  {#if toolStore.tool !== "playerStart"}
    <div class="group">
      <span class="label">Brush</span>
      {#each BRUSH_SIZES as size (size)}
        <button class:active={toolStore.brushSize === size} onclick={() => (toolStore.brushSize = size)}>
          {size}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .toolbar {
    display: flex;
    gap: 1rem;
    align-items: center;
    padding: 0.5rem;
    background: #1a1a1a;
    border-bottom: 1px solid #444;
    flex-wrap: wrap;
  }
  .group {
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }
  .label {
    color: #888;
    font-size: 0.85em;
    margin-right: 0.25rem;
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
  .swatch {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
  }
  .tex-swatch {
    padding: 2px;
  }
</style>
