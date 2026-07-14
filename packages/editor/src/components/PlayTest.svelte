<script lang="ts">
  import { onMount } from "svelte";
  import {
    renderFrame,
    renderHud,
    renderViewmodel,
    renderExitOverlay,
    InputController,
    createPlayerState,
    updatePlayer,
    playSfx,
    type Camera,
  } from "@blopple/runtime";
  import { mapStore } from "../lib/mapStore.svelte";

  let canvas: HTMLCanvasElement;
  let locked = $state(false);
  let debugOverlay = $state(false);
  let debugText = $state("");

  onMount(() => {
    const ctx = canvas.getContext("2d")!;
    // cloned, not the live editor map — door unlocks and key pickups mutate map state
    // as you play, and that shouldn't leak back into the map you're editing. Svelte 5's
    // $state proxy can't go through structuredClone (throws "Proxy object could not be
    // cloned"), so round-trip through JSON like App.svelte's exportMap already does.
    const map = JSON.parse(JSON.stringify(mapStore.map));
    const player = createPlayerState(map);
    const input = new InputController(canvas);
    input.start();

    const camera: Camera = { x: player.x, y: player.y, angle: player.angle, fov: Math.PI / 3 };

    const onLockChange = (): void => {
      locked = document.pointerLockElement === canvas;
    };
    document.addEventListener("pointerlockchange", onLockChange);

    let frameId: number;
    let last = performance.now();
    // exponential moving averages, not a rolling window — no per-frame array/allocation,
    // just one multiply-add per sample, cheap enough to leave the branch in unconditionally
    const EMA_ALPHA = 0.1;
    let frameMsEma = 0;
    let renderMsEma = 0;
    function loop(now: number): void {
      const rawFrameMs = now - last;
      const dt = Math.min(rawFrameMs / 1000, 0.1);
      last = now;

      updatePlayer(player, map, map.player, input.poll(), dt);
      camera.x = player.x;
      camera.y = player.y;
      camera.angle = player.angle;

      if (player.justFired) {
        const weapon = map.weapons.find((w) => w.id === player.heldWeaponIds[player.equippedIndex]);
        playSfx(map, weapon?.sfxId ?? null);
      }

      const renderStart = performance.now();
      renderFrame(ctx, map, camera, canvas.width, canvas.height, player.keys, new Set(player.heldWeaponIds));
      const renderMs = performance.now() - renderStart;
      renderViewmodel(ctx, map, player, canvas.width, canvas.height);
      renderHud(ctx, map, player, canvas.width, canvas.height);
      if (player.hasReachedExit) renderExitOverlay(ctx, map, canvas.width, canvas.height);

      if (debugOverlay) {
        frameMsEma = frameMsEma === 0 ? rawFrameMs : frameMsEma + (rawFrameMs - frameMsEma) * EMA_ALPHA;
        renderMsEma = renderMsEma === 0 ? renderMs : renderMsEma + (renderMs - renderMsEma) * EMA_ALPHA;
        debugText = `${Math.round(1000 / frameMsEma)} fps  |  frame ${frameMsEma.toFixed(1)}ms  |  renderFrame ${renderMsEma.toFixed(1)}ms`;
      }

      frameId = requestAnimationFrame(loop);
    }
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      document.removeEventListener("pointerlockchange", onLockChange);
      input.stop();
    };
  });
</script>

<div class="play">
  <canvas bind:this={canvas} width="800" height="500"></canvas>
  <button class="debug-toggle" onclick={() => (debugOverlay = !debugOverlay)}>
    {debugOverlay ? "Hide" : "Show"} perf
  </button>
  {#if debugOverlay}
    <div class="debug-overlay">{debugText}</div>
  {/if}
  {#if !locked}
    <div class="hint">Click to play — WASD to move, mouse or arrow keys to look</div>
  {/if}
</div>

<style>
  .play {
    position: relative;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
  }
  canvas {
    max-width: 100%;
    max-height: 100%;
  }
  .hint {
    position: absolute;
    bottom: 1rem;
    left: 50%;
    transform: translateX(-50%);
    color: #eee;
    background: rgba(0, 0, 0, 0.6);
    padding: 0.4rem 0.8rem;
    font-family: monospace;
    pointer-events: none;
  }
  .debug-toggle {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    font-family: monospace;
    font-size: 0.75rem;
    color: #eee;
    background: rgba(0, 0, 0, 0.6);
    border: 1px solid #555;
    padding: 0.2rem 0.5rem;
    cursor: pointer;
  }
  .debug-overlay {
    position: absolute;
    top: 0.5rem;
    left: 0.5rem;
    color: #0f0;
    background: rgba(0, 0, 0, 0.6);
    padding: 0.3rem 0.6rem;
    font-family: monospace;
    font-size: 0.8rem;
    pointer-events: none;
    white-space: pre;
  }
</style>
