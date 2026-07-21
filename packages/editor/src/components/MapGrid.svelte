<script lang="ts">
  import { onMount } from "svelte";
  import type { TextureDef } from "@blopple/shared";
  import { TEXTURE_SIZE, KEY_COLOR_HEX, EXIT_COLOR_HEX } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import { toolStore } from "../lib/toolStore.svelte";
  import { textureIdToColor, parseTextureRef } from "../lib/color";

  const BASE_CELL_PX = 28;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 4;
  const PAN_MARGIN = 500;
  const WEAPON_PICKUP_COLOR = "#e67e22";
  const ENEMY_COLOR = "#e74c3c";

  // rebuilt fresh on every mount (this component is destroyed on tab switch), so no invalidation needed
  const textureCanvasCache = new Map<string, HTMLCanvasElement>();

  function textureCanvasFor(tex: TextureDef): HTMLCanvasElement {
    let tc = textureCanvasCache.get(tex.id);
    if (tc) return tc;
    tc = document.createElement("canvas");
    tc.width = TEXTURE_SIZE;
    tc.height = TEXTURE_SIZE;
    const tctx = tc.getContext("2d")!;
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        const c = tex.pixels[y * TEXTURE_SIZE + x];
        if (!c) continue;
        tctx.fillStyle = c;
        tctx.fillRect(x, y, 1, 1);
      }
    }
    textureCanvasCache.set(tex.id, tc);
    return tc;
  }

  let canvas: HTMLCanvasElement;
  let painting = false;
  let panning = false;
  let lastPanX = 0;
  let lastPanY = 0;
  let zoom = 1;
  let lastMapId: string | null = null;

  function cellPx(): number {
    return BASE_CELL_PX * zoom;
  }

  // canvas -> .canvas-wrap (pan margin) -> .stage.canvas-well (the actual scroll viewport)
  function scrollContainer(): HTMLElement | null {
    return canvas.parentElement?.parentElement ?? null;
  }

  function centerView(): void {
    const container = scrollContainer();
    if (!container) return;
    container.scrollLeft = PAN_MARGIN + canvas.width / 2 - container.clientWidth / 2;
    container.scrollTop = PAN_MARGIN + canvas.height / 2 - container.clientHeight / 2;
  }

  function fillCell(ctx: CanvasRenderingContext2D, cx: number, cy: number, px: number, ref: string | null): void {
    const parsed = parseTextureRef(ref);
    if (parsed?.kind === "texture") {
      const tex = mapStore.textureAt(parsed.id);
      if (tex) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(textureCanvasFor(tex), cx, cy, px, px);
        return;
      }
    }
    ctx.fillStyle = textureIdToColor(ref);
    ctx.fillRect(cx, cy, px, px);
  }

  function draw(): void {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const map = mapStore.map;
    const px = cellPx();
    canvas.width = map.width * px;
    canvas.height = map.height * px;

    for (const cell of map.cells) {
      const cx = cell.x * px;
      const cy = cell.y * px;

      fillCell(ctx, cx, cy, px, cell.wallTextureId && !cell.doorColor ? cell.wallTextureId : cell.floorTextureId);

      if (cell.doorColor) {
        ctx.fillStyle = KEY_COLOR_HEX[cell.doorColor];
        ctx.fillRect(cx + px * 0.3, cy, px * 0.4, px);
      }

      if (!cell.wallTextureId && cell.height > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = `${px * 0.5}px monospace`;
        ctx.fillText(String(cell.height), cx + px * 0.32, cy + px * 0.7);
      }

      ctx.strokeStyle = "#000";
      ctx.strokeRect(cx, cy, px, px);
    }

    for (const pickup of map.keyPickups) {
      ctx.fillStyle = KEY_COLOR_HEX[pickup.color];
      ctx.beginPath();
      ctx.arc(pickup.x * px, pickup.y * px, px * 0.22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }

    for (const pickup of map.weaponPickups) {
      ctx.fillStyle = WEAPON_PICKUP_COLOR;
      ctx.fillRect(pickup.x * px - px * 0.22, pickup.y * px - px * 0.22, px * 0.44, px * 0.44);
      ctx.strokeStyle = "#000";
      ctx.strokeRect(pickup.x * px - px * 0.22, pickup.y * px - px * 0.22, px * 0.44, px * 0.44);
    }

    for (const placement of map.enemies) {
      ctx.fillStyle = ENEMY_COLOR;
      ctx.beginPath();
      ctx.arc(placement.x * px, placement.y * px, px * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }

    const exit = map.exit;
    ctx.fillStyle = EXIT_COLOR_HEX;
    ctx.fillRect(exit.x * px - px * 0.25, exit.y * px - px * 0.25, px * 0.5, px * 0.5);
    ctx.strokeStyle = "#000";
    ctx.strokeRect(exit.x * px - px * 0.25, exit.y * px - px * 0.25, px * 0.5, px * 0.5);

    const ps = map.playerStart;
    ctx.fillStyle = "#00ffcc";
    ctx.beginPath();
    ctx.arc(ps.x * px, ps.y * px, px * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function cellFromEvent(e: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const px = cellPx();
    return {
      x: Math.floor((e.clientX - rect.left) / px),
      y: Math.floor((e.clientY - rect.top) / px),
    };
  }

  function paintRef(): string | null {
    if (toolStore.paintMode === "texture") {
      return toolStore.selectedTextureId ? `texture:${toolStore.selectedTextureId}` : null;
    }
    return `color:${toolStore.color}`;
  }

  function paintCell(x: number, y: number): void {
    const cell = mapStore.cellAt(x, y);
    if (!cell) return;
    const ref = paintRef();
    switch (toolStore.tool) {
      case "wall":
        if (!ref) break;
        cell.wallTextureId = ref;
        cell.doorColor = null;
        cell.doorOpen = false;
        break;
      case "floor":
        if (!ref) break;
        cell.floorTextureId = ref;
        break;
      case "ceiling":
        if (!ref) break;
        cell.ceilingTextureId = ref;
        break;
      case "erase":
        cell.wallTextureId = null;
        cell.doorColor = null;
        cell.doorOpen = false;
        break;
      case "door":
        cell.wallTextureId = null;
        cell.doorColor = toolStore.keyColor;
        cell.doorOpen = false;
        break;
      case "height":
        cell.height = toolStore.height;
        if (ref) cell.floorTextureId = ref;
        break;
    }
  }

  function applyTool(cx: number, cy: number): void {
    if (toolStore.tool === "playerStart") {
      mapStore.map.playerStart = { x: cx + 0.5, y: cy + 0.5, facing: 0 };
      draw();
      return;
    }
    if (toolStore.tool === "key") {
      mapStore.setKeyPickup(toolStore.keyColor, cx + 0.5, cy + 0.5);
      draw();
      return;
    }
    if (toolStore.tool === "weapon") {
      if (toolStore.selectedWeaponId) mapStore.placeWeaponPickup(toolStore.selectedWeaponId, cx + 0.5, cy + 0.5);
      draw();
      return;
    }
    if (toolStore.tool === "enemy") {
      if (toolStore.selectedEnemyId) mapStore.placeEnemy(toolStore.selectedEnemyId, cx + 0.5, cy + 0.5);
      draw();
      return;
    }
    if (toolStore.tool === "exit") {
      mapStore.setExit(cx + 0.5, cy + 0.5);
      draw();
      return;
    }
    const r = (toolStore.brushSize - 1) / 2;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        paintCell(cx + dx, cy + dy);
      }
    }
    draw();
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const container = scrollContainer();
    if (!container) return;

    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const worldX = cx / cellPx();
    const worldY = cy / cellPx();

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));
    draw();

    container.scrollLeft += worldX * cellPx() - cx;
    container.scrollTop += worldY * cellPx() - cy;
  }

  function onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    painting = true;
    const { x, y } = cellFromEvent(e);
    applyTool(x, y);
  }

  function onPointerMove(e: PointerEvent): void {
    if (!painting) return;
    const { x, y } = cellFromEvent(e);
    applyTool(x, y);
  }

  function onPointerUp(): void {
    painting = false;
  }

  $effect(() => {
    mapStore.map;
    draw();
  });

  // recenter only when a genuinely new/loaded map appears, not on every cell edit
  $effect(() => {
    const id = mapStore.map.id;
    if (id !== lastMapId) {
      lastMapId = id;
      requestAnimationFrame(centerView);
    }
  });

  // right-click-drag pan + wheel zoom are bound to the whole scrollable pane (not just the
  // canvas) so panning works from the empty space around the tilemap too
  onMount(() => {
    const container = scrollContainer();
    if (!container) return;

    const onPanContextMenu = (e: MouseEvent) => e.preventDefault();

    const onPanPointerDown = (e: PointerEvent) => {
      if (e.button !== 2) return;
      panning = true;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
    };

    const onPanPointerMove = (e: PointerEvent) => {
      if (!panning) return;
      container.scrollLeft -= e.clientX - lastPanX;
      container.scrollTop -= e.clientY - lastPanY;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
    };

    const onPanPointerUp = () => {
      panning = false;
    };

    container.addEventListener("contextmenu", onPanContextMenu);
    container.addEventListener("pointerdown", onPanPointerDown);
    container.addEventListener("pointermove", onPanPointerMove);
    container.addEventListener("pointerup", onPanPointerUp);
    container.addEventListener("pointerleave", onPanPointerUp);
    container.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      container.removeEventListener("contextmenu", onPanContextMenu);
      container.removeEventListener("pointerdown", onPanPointerDown);
      container.removeEventListener("pointermove", onPanPointerMove);
      container.removeEventListener("pointerup", onPanPointerUp);
      container.removeEventListener("pointerleave", onPanPointerUp);
      container.removeEventListener("wheel", onWheel);
    };
  });
</script>

<div class="canvas-wrap">
  <canvas
    bind:this={canvas}
    onpointerdown={onPointerDown}
    onpointermove={onPointerMove}
    onpointerup={onPointerUp}
    onpointerleave={onPointerUp}
  ></canvas>
</div>

<style>
  .canvas-wrap {
    display: inline-block;
    margin: 500px;
  }
  canvas {
    image-rendering: pixelated;
    border: 1px solid #444;
    cursor: crosshair;
    display: block;
  }
</style>
