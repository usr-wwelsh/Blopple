<script lang="ts">
  import type { TextureDef } from "@blopple/shared";
  import { TEXTURE_SIZE } from "@blopple/shared";

  let { texture, size = 32 }: { texture: TextureDef; size?: number } = $props();

  let canvas: HTMLCanvasElement;

  function draw(): void {
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    const px = size / TEXTURE_SIZE;
    ctx.clearRect(0, 0, size, size);
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        const c = texture.pixels[y * TEXTURE_SIZE + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x * px, y * px, px, px);
      }
    }
  }

  $effect(() => {
    texture.pixels;
    draw();
  });
</script>

<canvas bind:this={canvas} width={size} height={size}></canvas>

<style>
  canvas {
    image-rendering: pixelated;
    display: block;
    background:
      repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 50% / 8px 8px;
  }
</style>
