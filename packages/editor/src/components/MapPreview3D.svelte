<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
  import type { Cell, TextureDef } from "@blopple/shared";
  import { TEXTURE_SIZE } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import { textureIdToColor, parseTextureRef } from "../lib/color";

  const WALL_HEIGHT = 3;
  const STEP_HEIGHT = 1;
  const DOOR_COLOR = "color:#d4a017";

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
  const floorGeometry = new THREE.BoxGeometry(1, 0.1, 1);
  const doorGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT * 0.7, 0.15);
  const riserGeometries = new Map<number, THREE.BoxGeometry>();
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const canvasTextureCache = new Map<string, THREE.CanvasTexture>();

  // solid pillar filling the gap under a raised floor tile, so stepped cells
  // read as ground rising up rather than a floor slab floating in mid-air
  function riserGeometryFor(stepHeight: number): THREE.BoxGeometry {
    let g = riserGeometries.get(stepHeight);
    if (!g) {
      g = new THREE.BoxGeometry(1, stepHeight * STEP_HEIGHT, 1);
      riserGeometries.set(stepHeight, g);
    }
    return g;
  }

  function canvasTextureFor(tex: TextureDef): THREE.CanvasTexture {
    let ct = canvasTextureCache.get(tex.id);
    if (ct) return ct;
    const c = document.createElement("canvas");
    c.width = TEXTURE_SIZE;
    c.height = TEXTURE_SIZE;
    const cctx = c.getContext("2d")!;
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        cctx.fillStyle = tex.pixels[y * TEXTURE_SIZE + x] ?? "#000000";
        cctx.fillRect(x, y, 1, 1);
      }
    }
    ct = new THREE.CanvasTexture(c);
    ct.magFilter = THREE.NearestFilter;
    ct.minFilter = THREE.NearestFilter;
    ct.colorSpace = THREE.SRGBColorSpace;
    canvasTextureCache.set(tex.id, ct);
    return ct;
  }

  // grouping by ref caps draw calls to ~palette/texture-set size regardless of map dimensions
  function materialFor(ref: string | null): THREE.MeshStandardMaterial {
    const key = ref ?? "";
    let mat = materialCache.get(key);
    if (mat) return mat;

    const parsed = parseTextureRef(ref);
    const tex = parsed?.kind === "texture" ? mapStore.textureAt(parsed.id) : undefined;
    mat = tex
      ? new THREE.MeshStandardMaterial({ map: canvasTextureFor(tex) })
      : new THREE.MeshStandardMaterial({ color: textureIdToColor(ref) });
    materialCache.set(key, mat);
    return mat;
  }

  function instancedFrom(
    geometry: THREE.BufferGeometry,
    material: THREE.MeshStandardMaterial,
    cells: Cell[],
    yFor: (cell: Cell) => number,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, cells.length);
    const matrix = new THREE.Matrix4();
    cells.forEach((cell, i) => {
      matrix.setPosition(cell.x + 0.5, yFor(cell), cell.y + 0.5);
      mesh.setMatrixAt(i, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
  }

  function buildGroup(): THREE.Group {
    const group = new THREE.Group();
    const wallBuckets = new Map<string, Cell[]>();
    const floorBuckets = new Map<string, Cell[]>();
    // keyed on height+texture so pillar faces pick up the same texture as the
    // raised floor they sit under, while still sharing geometry per height
    const riserBuckets = new Map<string, { height: number; ref: string | null; cells: Cell[] }>();
    const doors: Cell[] = [];

    for (const cell of mapStore.map.cells) {
      if (cell.wallTextureId && !cell.isDoor) {
        const key = cell.wallTextureId;
        (wallBuckets.get(key) ?? wallBuckets.set(key, []).get(key)!).push(cell);
        continue;
      }
      const key = cell.floorTextureId ?? "";
      (floorBuckets.get(key) ?? floorBuckets.set(key, []).get(key)!).push(cell);
      if (cell.isDoor) doors.push(cell);
      if (cell.height > 0) {
        const riserKey = `${cell.height}:${key}`;
        const bucket = riserBuckets.get(riserKey) ?? { height: cell.height, ref: cell.floorTextureId, cells: [] };
        bucket.cells.push(cell);
        riserBuckets.set(riserKey, bucket);
      }
    }

    for (const [ref, cells] of wallBuckets) {
      group.add(instancedFrom(wallGeometry, materialFor(ref), cells, () => WALL_HEIGHT / 2));
    }
    for (const [ref, cells] of floorBuckets) {
      group.add(instancedFrom(floorGeometry, materialFor(ref || null), cells, (c) => c.height * STEP_HEIGHT));
    }
    for (const { height: stepHeight, ref, cells } of riserBuckets.values()) {
      group.add(
        instancedFrom(riserGeometryFor(stepHeight), materialFor(ref), cells, () => (stepHeight * STEP_HEIGHT) / 2),
      );
    }
    if (doors.length > 0) {
      group.add(
        instancedFrom(doorGeometry, materialFor(DOOR_COLOR), doors, (c) => c.height * STEP_HEIGHT + (WALL_HEIGHT * 0.7) / 2),
      );
    }

    return group;
  }

  onMount(() => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a1a);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 300);
    camera.position.set(mapStore.map.width / 2, 14, mapStore.map.height + 8);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(mapStore.map.width / 2, 0, mapStore.map.height / 2);
    controls.update();

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    let group = buildGroup();
    scene.add(group);

    let frameId = requestAnimationFrame(function animate() {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    });

    const resize = (): void => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", resize);

    const disposeRoot = $effect.root(() => {
      $effect(() => {
        mapStore.map;
        scene.remove(group);
        group = buildGroup();
        scene.add(group);
      });
    });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("resize", resize);
      disposeRoot();
      wallGeometry.dispose();
      floorGeometry.dispose();
      doorGeometry.dispose();
      riserGeometries.forEach((g) => g.dispose());
      materialCache.forEach((m) => m.dispose());
      canvasTextureCache.forEach((t) => t.dispose());
      controls.dispose();
      renderer.dispose();
    };
  });
</script>

<div class="preview" bind:this={container}>
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .preview {
    width: 100%;
    height: 100%;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
</style>
