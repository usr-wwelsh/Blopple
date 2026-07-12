<script lang="ts">
  import { TEXTURE_SIZE } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import { toolStore, type PixelTool, BRUSH_SIZES } from "../lib/toolStore.svelte";
  import { PALETTE, rgbToHex } from "../lib/color";
  import TextureThumb from "./TextureThumb.svelte";

  const BASE_PIXEL_PX = 8;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 8;
  const PAN_MARGIN = 300;

  const pixelTools: { id: PixelTool; label: string }[] = [
    { id: "pencil", label: "Pencil" },
    { id: "eraser", label: "Eraser" },
    { id: "fill", label: "Fill" },
  ];

  let editingId = $state<string | null>(mapStore.map.textures[0]?.id ?? null);
  let canvas = $state<HTMLCanvasElement>();
  let fileInput = $state<HTMLInputElement>();
  let painting = false;
  let panning = false;
  let lastPanX = 0;
  let lastPanY = 0;
  let zoom = 1;

  const editing = $derived(editingId ? mapStore.textureAt(editingId) : undefined);

  function pixelPx(): number {
    return BASE_PIXEL_PX * zoom;
  }

  // canvas -> .canvas-wrap (pan margin) -> .canvas-scroll (the actual scroll viewport)
  function scrollContainer(): HTMLElement | null {
    return canvas?.parentElement?.parentElement ?? null;
  }

  function centerView(): void {
    const container = scrollContainer();
    if (!container || !canvas) return;
    container.scrollLeft = PAN_MARGIN + canvas.width / 2 - container.clientWidth / 2;
    container.scrollTop = PAN_MARGIN + canvas.height / 2 - container.clientHeight / 2;
  }

  function draw(): void {
    const ctx = canvas?.getContext("2d");
    const tex = editing;
    if (!ctx || !canvas || !tex) return;
    const px = pixelPx();
    canvas.width = TEXTURE_SIZE * px;
    canvas.height = TEXTURE_SIZE * px;
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        const c = tex.pixels[y * TEXTURE_SIZE + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * px, y * px, px, px);
      }
    }
  }

  function floodFill(pixels: (string | null)[], startIdx: number, target: string | null, replacement: string | null): void {
    if (target === replacement) return;
    const stack = [startIdx];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      if (pixels[idx] !== target) continue;
      pixels[idx] = replacement;
      const x = idx % TEXTURE_SIZE;
      const y = Math.floor(idx / TEXTURE_SIZE);
      if (x > 0) stack.push(idx - 1);
      if (x < TEXTURE_SIZE - 1) stack.push(idx + 1);
      if (y > 0) stack.push(idx - TEXTURE_SIZE);
      if (y < TEXTURE_SIZE - 1) stack.push(idx + TEXTURE_SIZE);
    }
  }

  function paintAt(e: PointerEvent): void {
    const tex = editing;
    if (!tex) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * TEXTURE_SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * TEXTURE_SIZE);
    if (x < 0 || y < 0 || x >= TEXTURE_SIZE || y >= TEXTURE_SIZE) return;

    if (toolStore.pixelTool === "fill") {
      const idx = y * TEXTURE_SIZE + x;
      floodFill(tex.pixels, idx, tex.pixels[idx], toolStore.color);
      draw();
      return;
    }

    const value = toolStore.pixelTool === "eraser" ? null : toolStore.color;
    const r = (toolStore.pixelBrushSize - 1) / 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const px = x + dx;
        const py = y + dy;
        if (px < 0 || py < 0 || px >= TEXTURE_SIZE || py >= TEXTURE_SIZE) continue;
        tex.pixels[py * TEXTURE_SIZE + px] = value;
      }
    }
    draw();
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const container = scrollContainer();
    if (!container || !canvas) return;

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldX = cx / pixelPx();
    const worldY = cy / pixelPx();

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    draw();

    container.scrollLeft += worldX * pixelPx() - cx;
    container.scrollTop += worldY * pixelPx() - cy;
  }

  function onContextMenu(e: MouseEvent): void {
    e.preventDefault();
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button === 2) {
      panning = true;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      return;
    }
    if (e.button !== 0) return;
    painting = true;
    paintAt(e);
  }

  function onPointerMove(e: PointerEvent): void {
    if (panning) {
      const container = scrollContainer();
      if (container) {
        container.scrollLeft -= e.clientX - lastPanX;
        container.scrollTop -= e.clientY - lastPanY;
      }
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      return;
    }
    if (!painting) return;
    paintAt(e);
  }

  function onPointerUp(): void {
    painting = false;
    panning = false;
  }

  function newTexture(): void {
    const tex = mapStore.addTexture();
    editingId = tex.id;
  }

  function duplicateTexture(): void {
    if (!editingId) return;
    const tex = mapStore.duplicateTexture(editingId);
    if (tex) editingId = tex.id;
  }

  function deleteTexture(): void {
    if (!editingId) return;
    if (!confirm("Delete this texture? Cells using it will lose their texture.")) return;
    const id = editingId;
    editingId = null;
    mapStore.removeTexture(id);
    editingId = mapStore.map.textures[0]?.id ?? null;
  }

  function renameTexture(e: Event): void {
    if (!editingId) return;
    mapStore.renameTexture(editingId, (e.target as HTMLInputElement).value);
  }

  function importImage(): void {
    fileInput?.click();
  }

  function onImportFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    const tex = editing;
    if (!file || !tex) return;

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = TEXTURE_SIZE;
      off.height = TEXTURE_SIZE;
      const octx = off.getContext("2d")!;
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      octx.drawImage(img, sx, sy, side, side, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

      const { data } = octx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      const pixels: (string | null)[] = new Array(TEXTURE_SIZE * TEXTURE_SIZE);
      for (let i = 0; i < pixels.length; i++) {
        const a = data[i * 4 + 3];
        pixels[i] = a < 16 ? null : rgbToHex(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      }
      tex.pixels = pixels;
      draw();
      URL.revokeObjectURL(url);
    };
    img.src = url;
    input.value = "";
  }

  let centered = false;

  $effect(() => {
    editing?.pixels;
    draw();
  });

  $effect(() => {
    if (canvas && !centered) {
      centered = true;
      requestAnimationFrame(centerView);
    }
  });
</script>

<div class="texture-editor">
  <div class="sidebar">
    <div class="sidebar-actions">
      <button onclick={newTexture}>New</button>
      <button onclick={duplicateTexture} disabled={!editingId}>Duplicate</button>
      <button onclick={deleteTexture} disabled={!editingId}>Delete</button>
    </div>
    <div class="list">
      {#each mapStore.map.textures as t (t.id)}
        <button class="list-item" class:active={editingId === t.id} onclick={() => (editingId = t.id)}>
          <TextureThumb texture={t} size={28} />
          <span>{t.name}</span>
        </button>
      {/each}
      {#if mapStore.map.textures.length === 0}
        <p class="hint">No textures yet. Click "New" to start painting one.</p>
      {/if}
    </div>
  </div>

  <div class="canvas-pane">
    {#if editing}
      <input class="name" type="text" value={editing.name} oninput={renameTexture} />
      <div class="tools">
        <div class="group">
          {#each pixelTools as pt (pt.id)}
            <button class:active={toolStore.pixelTool === pt.id} onclick={() => (toolStore.pixelTool = pt.id)}>
              {pt.label}
            </button>
          {/each}
        </div>
        <div class="group">
          {#each BRUSH_SIZES as size (size)}
            <button class:active={toolStore.pixelBrushSize === size} onclick={() => (toolStore.pixelBrushSize = size)}>
              {size}px
            </button>
          {/each}
        </div>
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
          <input class="picker" type="color" bind:value={toolStore.color} aria-label="custom color" />
        </div>
        <div class="group">
          <button onclick={importImage}>Import image</button>
          <input
            bind:this={fileInput}
            class="file-input"
            type="file"
            accept="image/*"
            onchange={onImportFile}
          />
        </div>
      </div>
      <div class="canvas-scroll">
        <div class="canvas-wrap">
          <canvas
            bind:this={canvas}
            onpointerdown={onPointerDown}
            onpointermove={onPointerMove}
            onpointerup={onPointerUp}
            onpointerleave={onPointerUp}
            onwheel={onWheel}
            oncontextmenu={onContextMenu}
          ></canvas>
        </div>
      </div>
    {:else}
      <p class="hint">Select or create a texture to start painting.</p>
    {/if}
  </div>
</div>

<style>
  .texture-editor {
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
    text-align: left;
    overflow: hidden;
  }
  .list-item span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .canvas-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    padding: 1rem;
    overflow: hidden;
    min-height: 0;
  }
  .canvas-scroll {
    width: 100%;
    flex: 1;
    overflow: auto;
    min-height: 0;
  }
  .canvas-wrap {
    display: inline-block;
    margin: 300px;
  }
  .name {
    background: #2a2a2a;
    color: #eee;
    border: 1px solid #444;
    padding: 0.3rem;
    font: inherit;
    width: 16rem;
  }
  .tools {
    display: flex;
    gap: 1rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .group {
    display: flex;
    gap: 0.25rem;
    align-items: center;
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
  button:disabled {
    color: #555;
    cursor: not-allowed;
  }
  .swatch {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
  }
  .picker {
    width: 1.5rem;
    height: 1.5rem;
    padding: 0;
    border: 1px solid #444;
    background: #2a2a2a;
    cursor: pointer;
  }
  .file-input {
    display: none;
  }
  canvas {
    image-rendering: pixelated;
    border: 1px solid #444;
    cursor: crosshair;
    touch-action: none;
    display: block;
    background:
      repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 50% / 16px 16px;
  }
  .hint {
    color: #888;
    font-size: 0.9em;
  }
</style>
