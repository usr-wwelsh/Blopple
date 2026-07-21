<script lang="ts">
  import { KEY_COLORS, KEY_COLOR_HEX } from "@blopple/shared";
  import { toolStore, type Tool, BRUSH_SIZES } from "../lib/toolStore.svelte";
  import { PALETTE } from "../lib/color";
  import { mapStore } from "../lib/mapStore.svelte";
  import TextureThumb from "./TextureThumb.svelte";
  import ToolIcon from "./ToolIcon.svelte";

  const tools: { id: Tool; label: string }[] = [
    { id: "wall", label: "Wall" },
    { id: "floor", label: "Floor" },
    { id: "ceiling", label: "Ceiling" },
    { id: "door", label: "Door" },
    { id: "key", label: "Key" },
    { id: "weapon", label: "Weapon" },
    { id: "enemy", label: "Enemy" },
    { id: "exit", label: "Exit" },
    { id: "height", label: "Height" },
    { id: "playerStart", label: "Player Start" },
    { id: "erase", label: "Erase" },
  ];

  const heightLabels = ["Low", "Mid", "High"];

  const hasOptions = $derived(
    toolStore.tool === "height" ||
      toolStore.tool === "door" ||
      toolStore.tool === "key" ||
      toolStore.tool === "weapon" ||
      toolStore.tool === "enemy" ||
      toolStore.tool === "wall" ||
      toolStore.tool === "floor" ||
      toolStore.tool === "ceiling",
  );
</script>

<aside class="side-panel">
  <div class="panel-section">
    <div class="section-label">Tools</div>
    <div class="icon-grid">
      {#each tools as t (t.id)}
        <button class="tool-btn" class:active={toolStore.tool === t.id} title={t.label} onclick={() => (toolStore.tool = t.id)}>
          <ToolIcon tool={t.id} />
          <span class="tool-label">{t.label}</span>
        </button>
      {/each}
    </div>
  </div>

  {#if hasOptions}
    <div class="panel-section options">
      <div class="section-label">Options</div>

      {#if toolStore.tool === "height"}
        <div class="option-row">
          {#each [0, 1, 2] as h (h)}
            <button class="chip" class:active={toolStore.height === h} onclick={() => (toolStore.height = h as 0 | 1 | 2)}>
              {heightLabels[h]}
            </button>
          {/each}
        </div>
      {/if}

      {#if toolStore.tool === "door" || toolStore.tool === "key"}
        <div class="option-row wrap">
          {#each KEY_COLORS as c (c)}
            <button
              class="swatch"
              class:active={toolStore.keyColor === c}
              style="background:{KEY_COLOR_HEX[c]}"
              onclick={() => (toolStore.keyColor = c)}
              aria-label={c}
            ></button>
          {/each}
        </div>
      {/if}

      {#if toolStore.tool === "weapon"}
        <div class="option-list">
          {#each mapStore.map.weapons as w (w.id)}
            <button class="list-chip" class:active={toolStore.selectedWeaponId === w.id} onclick={() => (toolStore.selectedWeaponId = w.id)}>
              {w.name}
            </button>
          {/each}
          {#if mapStore.map.weapons.length === 0}
            <span class="hint">no weapons yet — add one in the Weapons tab</span>
          {/if}
        </div>
      {/if}

      {#if toolStore.tool === "enemy"}
        <div class="option-list">
          {#each mapStore.map.enemyDefs as e (e.id)}
            <button class="list-chip" class:active={toolStore.selectedEnemyId === e.id} onclick={() => (toolStore.selectedEnemyId = e.id)}>
              {e.name}
            </button>
          {/each}
          {#if mapStore.map.enemyDefs.length === 0}
            <span class="hint">no enemies yet — add one in the Enemies tab</span>
          {/if}
        </div>
      {/if}

      {#if toolStore.tool === "wall" || toolStore.tool === "floor" || toolStore.tool === "ceiling"}
        <div class="option-row">
          <button class="chip" class:active={toolStore.paintMode === "color"} onclick={() => (toolStore.paintMode = "color")}>
            Color
          </button>
          <button class="chip" class:active={toolStore.paintMode === "texture"} onclick={() => (toolStore.paintMode = "texture")}>
            Texture
          </button>
        </div>

        {#if toolStore.paintMode === "color"}
          <div class="option-row wrap">
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
          <div class="option-row wrap">
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
              <span class="hint">no textures yet — paint one in the Textures tab</span>
            {/if}
          </div>
        {/if}
      {/if}
    </div>
  {/if}

  {#if toolStore.tool !== "playerStart" && toolStore.tool !== "key" && toolStore.tool !== "weapon" && toolStore.tool !== "enemy" && toolStore.tool !== "exit"}
    <div class="panel-section">
      <div class="section-label">Brush</div>
      <div class="option-row">
        {#each BRUSH_SIZES as size (size)}
          <button class="chip" class:active={toolStore.brushSize === size} onclick={() => (toolStore.brushSize = size)}>
            {size}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</aside>

<style>
  .side-panel {
    width: 15rem;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    padding: 0.75rem;
    background: var(--bg-panel);
    border-right: 1px solid var(--border);
    overflow-y: auto;
  }
  .panel-section {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }
  .panel-section.options {
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
  }
  .section-label {
    color: var(--text-dim);
    font-size: 0.7em;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .icon-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.3rem;
  }
  .tool-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    padding: 0.4rem 0.15rem;
    background: var(--bg-control);
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 2px;
    box-shadow: inset 0 1px 0 var(--border-light);
    cursor: pointer;
  }
  .tool-label {
    font-size: 0.62em;
    line-height: 1.1;
    text-align: center;
    letter-spacing: 0.01em;
  }
  .tool-btn:hover {
    color: var(--text);
    background: var(--bg-control-hover);
  }
  .tool-btn.active {
    color: var(--accent);
    background: var(--accent-glow);
    border-color: var(--accent-dim);
    box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.45);
  }
  .option-row {
    display: flex;
    gap: 0.3rem;
    align-items: center;
  }
  .option-row.wrap {
    flex-wrap: wrap;
  }
  .option-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  .chip,
  .list-chip {
    background: var(--bg-control);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 0.3rem 0.55rem;
    cursor: pointer;
    font: inherit;
    font-size: 0.85em;
  }
  .chip {
    flex: 1;
    text-align: center;
  }
  .list-chip {
    text-align: left;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .chip.active,
  .list-chip.active {
    color: var(--accent);
    background: var(--accent-glow);
    border-color: var(--accent-dim);
  }
  .hint {
    color: var(--text-dim);
    font-size: 0.8em;
  }
  .swatch {
    width: 1.4rem;
    height: 1.4rem;
    padding: 0;
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
  }
  .swatch.active {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  .tex-swatch {
    padding: 2px;
    background: var(--bg-control);
    border: 1px solid var(--border);
    border-radius: 2px;
    cursor: pointer;
  }
  .tex-swatch.active {
    border-color: var(--accent);
  }
</style>
