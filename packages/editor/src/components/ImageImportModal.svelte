<script lang="ts">
  import { TEXTURE_SIZE } from "@blopple/shared";
  import { rgbToHex } from "../lib/color";

  const { imageUrl, onApply, onCancel }: {
    imageUrl: string;
    onApply: (pixels: (string | null)[]) => void;
    onCancel: () => void;
  } = $props();

  const VIEW_SIZE = 320;
  const MAX_RGB_DIST = Math.sqrt(255 * 255 * 3);

  let cropCanvas = $state<HTMLCanvasElement>();
  let resultCanvas = $state<HTMLCanvasElement>();
  let img: HTMLImageElement | null = null;

  let scale = $state(1);
  let minScale = $state(0.01);
  let maxScale = $state(8);
  let panX = 0;
  let panY = 0;

  let dragging = false;
  let moved = false;
  let lastX = 0;
  let lastY = 0;

  let removeBg = $state(false);
  let keyColor = $state({ r: 255, g: 255, b: 255 });
  let tolerance = $state(30);
  let eyedropperArmed = $state(false);

  $effect(() => {
    const image = new Image();
    image.onload = () => {
      img = image;
      const fitScale = VIEW_SIZE / Math.min(image.width, image.height);
      scale = fitScale;
      minScale = VIEW_SIZE / Math.max(image.width, image.height);
      maxScale = fitScale * 8;
      panX = (VIEW_SIZE - image.width * scale) / 2;
      panY = (VIEW_SIZE - image.height * scale) / 2;
      drawCrop();
      drawResult();
    };
    image.src = imageUrl;
  });

  $effect(() => {
    removeBg;
    tolerance;
    keyColor;
    drawResult();
  });

  function clampPan(): void {
    if (!img) return;
    const dw = img.width * scale;
    const dh = img.height * scale;
    panX = Math.min(0, Math.max(VIEW_SIZE - dw, panX));
    panY = Math.min(0, Math.max(VIEW_SIZE - dh, panY));
  }

  function drawCrop(): void {
    const ctx = cropCanvas?.getContext("2d");
    if (!ctx || !img || !cropCanvas) return;
    cropCanvas.width = VIEW_SIZE;
    cropCanvas.height = VIEW_SIZE;
    ctx.clearRect(0, 0, VIEW_SIZE, VIEW_SIZE);
    ctx.drawImage(img, panX, panY, img.width * scale, img.height * scale);
  }

  function drawResult(): void {
    const ctx = resultCanvas?.getContext("2d");
    if (!ctx || !img || !resultCanvas) return;
    resultCanvas.width = TEXTURE_SIZE;
    resultCanvas.height = TEXTURE_SIZE;
    ctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    const sx = -panX / scale;
    const sy = -panY / scale;
    const sSize = VIEW_SIZE / scale;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);

    if (removeBg) {
      const imageData = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
      const data = imageData.data;
      const thresh = (tolerance / 100) * MAX_RGB_DIST;
      for (let i = 0; i < data.length; i += 4) {
        const dr = data[i] - keyColor.r;
        const dg = data[i + 1] - keyColor.g;
        const db = data[i + 2] - keyColor.b;
        if (Math.sqrt(dr * dr + dg * dg + db * db) <= thresh) data[i + 3] = 0;
      }
      ctx.putImageData(imageData, 0, 0);
    }
  }

  function extractPixels(): (string | null)[] {
    const ctx = resultCanvas?.getContext("2d");
    const pixels: (string | null)[] = new Array(TEXTURE_SIZE * TEXTURE_SIZE).fill(null);
    if (!ctx) return pixels;
    const { data } = ctx.getImageData(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
    for (let i = 0; i < pixels.length; i++) {
      const a = data[i * 4 + 3];
      pixels[i] = a < 16 ? null : rgbToHex(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
    }
    return pixels;
  }

  function pickColorAt(e: PointerEvent): void {
    const ctx = cropCanvas?.getContext("2d");
    if (!ctx || !cropCanvas) return;
    const rect = cropCanvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * VIEW_SIZE);
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * VIEW_SIZE);
    const { data } = ctx.getImageData(x, y, 1, 1);
    keyColor = { r: data[0], g: data[1], b: data[2] };
    removeBg = true;
  }

  function onCropPointerDown(e: PointerEvent): void {
    if (eyedropperArmed) {
      pickColorAt(e);
      eyedropperArmed = false;
      return;
    }
    dragging = true;
    moved = false;
    lastX = e.clientX;
    lastY = e.clientY;
  }

  function onCropPointerMove(e: PointerEvent): void {
    if (!dragging || !img) return;
    moved = true;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    clampPan();
    drawCrop();
    drawResult();
  }

  function onCropPointerUp(): void {
    dragging = false;
  }

  function onCropWheel(e: WheelEvent): void {
    e.preventDefault();
    if (!img || !cropCanvas) return;
    const rect = cropCanvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * VIEW_SIZE;
    const cy = ((e.clientY - rect.top) / rect.height) * VIEW_SIZE;
    zoomAbout(cx, cy, e.deltaY < 0 ? 1.1 : 1 / 1.1);
  }

  function zoomAbout(cx: number, cy: number, factor: number): void {
    if (!img) return;
    const worldX = (cx - panX) / scale;
    const worldY = (cy - panY) / scale;
    scale = Math.min(maxScale, Math.max(minScale, scale * factor));
    panX = cx - worldX * scale;
    panY = cy - worldY * scale;
    clampPan();
    drawCrop();
    drawResult();
  }

  function onZoomSlider(e: Event): void {
    const value = Number((e.target as HTMLInputElement).value);
    if (!img) return;
    const worldX = (VIEW_SIZE / 2 - panX) / scale;
    const worldY = (VIEW_SIZE / 2 - panY) / scale;
    scale = value;
    panX = VIEW_SIZE / 2 - worldX * scale;
    panY = VIEW_SIZE / 2 - worldY * scale;
    clampPan();
    drawCrop();
    drawResult();
  }

  function armEyedropper(): void {
    eyedropperArmed = true;
  }

  function apply(): void {
    onApply(extractPixels());
  }
</script>

<div class="modal-backdrop">
  <div class="modal">
    <span class="section-label">Import image</span>
    <div class="body">
      <div class="crop-pane">
        <canvas
          class="crop-canvas"
          class:eyedropper={eyedropperArmed}
          bind:this={cropCanvas}
          onpointerdown={onCropPointerDown}
          onpointermove={onCropPointerMove}
          onpointerup={onCropPointerUp}
          onpointerleave={onCropPointerUp}
          onwheel={onCropWheel}
        ></canvas>
        <input
          type="range"
          min={minScale}
          max={maxScale}
          step={(maxScale - minScale) / 200 || 0.01}
          value={scale}
          oninput={onZoomSlider}
        />
        <span class="hint">Drag to pan &middot; scroll or slider to zoom</span>
      </div>

      <div class="controls-pane">
        <span class="section-label">Preview</span>
        <canvas class="result-canvas" bind:this={resultCanvas}></canvas>

        <label class="row">
          <input type="checkbox" bind:checked={removeBg} />
          Remove background
        </label>
        {#if removeBg}
          <div class="bg-controls">
            <div class="row">
              <button class:active={eyedropperArmed} onclick={armEyedropper}>
                {eyedropperArmed ? "Click image…" : "Pick color"}
              </button>
              <span class="swatch" style="background: rgb({keyColor.r}, {keyColor.g}, {keyColor.b})"></span>
            </div>
            <label class="row">
              Tolerance
              <input type="range" min="0" max="100" bind:value={tolerance} />
              <span class="tolerance-value">{tolerance}</span>
            </label>
          </div>
        {/if}
      </div>
    </div>

    <div class="actions">
      <button onclick={onCancel}>Cancel</button>
      <button onclick={apply}>Apply</button>
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
    background: #222;
    border: 1px solid #444;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }
  .section-label {
    color: #888;
    font-size: 0.75em;
    text-transform: uppercase;
  }
  .body {
    display: flex;
    gap: 1.5rem;
  }
  .crop-pane {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .crop-canvas {
    width: 320px;
    height: 320px;
    border: 1px solid #444;
    cursor: grab;
    touch-action: none;
    background:
      repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 50% / 16px 16px;
  }
  .crop-canvas.eyedropper {
    cursor: crosshair;
  }
  .controls-pane {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    width: 12rem;
  }
  .result-canvas {
    width: 128px;
    height: 128px;
    image-rendering: pixelated;
    border: 1px solid #444;
    background:
      repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 50% / 16px 16px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9em;
    color: #bbb;
  }
  .row input[type="range"] {
    flex: 1;
    min-width: 0;
  }
  .bg-controls {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .swatch {
    display: inline-block;
    width: 1.3rem;
    height: 1.3rem;
    border: 1px solid #444;
  }
  .tolerance-value {
    width: 2ch;
    text-align: right;
  }
  .hint {
    color: #888;
    font-size: 0.8em;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
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
  input[type="checkbox"] {
    accent-color: #888;
  }
</style>
