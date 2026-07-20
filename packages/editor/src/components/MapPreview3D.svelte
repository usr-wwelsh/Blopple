<script lang="ts">
  import { onMount } from "svelte";
  import * as THREE from "three";
  import { OrbitControls } from "three/addons/controls/OrbitControls.js";
  import type { Cell, KeyColor, TextureDef } from "@blopple/shared";
  import { TEXTURE_SIZE, KEY_COLOR_HEX, EXIT_COLOR_HEX } from "@blopple/shared";
  import { mapStore } from "../lib/mapStore.svelte";
  import { textureIdToColor, parseTextureRef } from "../lib/color";

  const WALL_HEIGHT = 3;
  const STEP_HEIGHT = 1;
  const EXIT_COLOR = `color:${EXIT_COLOR_HEX}`;

  let container: HTMLDivElement;
  let canvas: HTMLCanvasElement;

  const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
  const floorGeometry = new THREE.BoxGeometry(1, 0.1, 1);
  const doorGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT * 0.7, 0.15);
  const keyMarkerGeometry = new THREE.SphereGeometry(0.18, 12, 8);
  const exitMarkerGeometry = new THREE.ConeGeometry(0.25, 0.5, 8);
  const riserGeometries = new Map<number, THREE.BoxGeometry>();
  const materialCache = new Map<string, THREE.MeshStandardMaterial>();
  const canvasTextureCache = new Map<string, THREE.CanvasTexture>();
  const spriteMaterialCache = new Map<string, THREE.SpriteMaterial>();
  const spriteTextureCache = new Map<string, THREE.CanvasTexture>();

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

  // unlike canvasTextureFor, leaves null pixels transparent instead of opaque black —
  // billboards need cutout alpha the way the raycaster's billboard renderer does
  function spriteCanvasTextureFor(tex: TextureDef): THREE.CanvasTexture {
    let ct = spriteTextureCache.get(tex.id);
    if (ct) return ct;
    const c = document.createElement("canvas");
    c.width = TEXTURE_SIZE;
    c.height = TEXTURE_SIZE;
    const cctx = c.getContext("2d")!;
    for (let y = 0; y < TEXTURE_SIZE; y++) {
      for (let x = 0; x < TEXTURE_SIZE; x++) {
        const color = tex.pixels[y * TEXTURE_SIZE + x];
        if (color === null) continue;
        cctx.fillStyle = color;
        cctx.fillRect(x, y, 1, 1);
      }
    }
    ct = new THREE.CanvasTexture(c);
    ct.magFilter = THREE.NearestFilter;
    ct.minFilter = THREE.NearestFilter;
    ct.colorSpace = THREE.SRGBColorSpace;
    spriteTextureCache.set(tex.id, ct);
    return ct;
  }

  function spriteMaterialFor(ref: string | null): THREE.SpriteMaterial {
    const key = ref ?? "";
    let mat = spriteMaterialCache.get(key);
    if (mat) return mat;

    const parsed = parseTextureRef(ref);
    const tex = parsed?.kind === "texture" ? mapStore.textureAt(parsed.id) : undefined;
    mat = tex
      ? new THREE.SpriteMaterial({ map: spriteCanvasTextureFor(tex), transparent: true })
      : new THREE.SpriteMaterial({ color: textureIdToColor(ref) });
    spriteMaterialCache.set(key, mat);
    return mat;
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
    const doorBuckets = new Map<KeyColor, Cell[]>();

    for (const cell of mapStore.map.cells) {
      if (cell.wallTextureId && !cell.doorColor) {
        const key = cell.wallTextureId;
        (wallBuckets.get(key) ?? wallBuckets.set(key, []).get(key)!).push(cell);
        continue;
      }
      const key = cell.floorTextureId ?? "";
      (floorBuckets.get(key) ?? floorBuckets.set(key, []).get(key)!).push(cell);
      if (cell.doorColor) {
        (doorBuckets.get(cell.doorColor) ?? doorBuckets.set(cell.doorColor, []).get(cell.doorColor)!).push(cell);
      }
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
    for (const [color, cells] of doorBuckets) {
      group.add(
        instancedFrom(doorGeometry, materialFor(`color:${KEY_COLOR_HEX[color]}`), cells, (c) => c.height * STEP_HEIGHT + (WALL_HEIGHT * 0.7) / 2),
      );
    }

    for (const pickup of mapStore.map.keyPickups) {
      const cell = mapStore.cellAt(Math.floor(pickup.x), Math.floor(pickup.y));
      const mesh = new THREE.Mesh(keyMarkerGeometry, materialFor(`color:${KEY_COLOR_HEX[pickup.color]}`));
      mesh.position.set(pickup.x, (cell?.height ?? 0) * STEP_HEIGHT + 0.4, pickup.y);
      group.add(mesh);
    }

    const exit = mapStore.map.exit;
    const exitCell = mapStore.cellAt(Math.floor(exit.x), Math.floor(exit.y));
    const exitMesh = new THREE.Mesh(exitMarkerGeometry, materialFor(EXIT_COLOR));
    exitMesh.position.set(exit.x, (exitCell?.height ?? 0) * STEP_HEIGHT + 0.5, exit.y);
    group.add(exitMesh);

    for (const placement of mapStore.map.enemies) {
      const def = mapStore.enemyAt(placement.enemyId);
      if (!def) continue;
      const cell = mapStore.cellAt(Math.floor(placement.x), Math.floor(placement.y));
      const floorY = (cell?.height ?? 0) * STEP_HEIGHT;
      const sprite = new THREE.Sprite(spriteMaterialFor(def.spriteRef));
      sprite.scale.set(def.width, def.height, 1);
      sprite.position.set(placement.x, floorY + def.height / 2, placement.y);
      group.add(sprite);
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
      keyMarkerGeometry.dispose();
      exitMarkerGeometry.dispose();
      riserGeometries.forEach((g) => g.dispose());
      materialCache.forEach((m) => m.dispose());
      canvasTextureCache.forEach((t) => t.dispose());
      spriteMaterialCache.forEach((m) => m.dispose());
      spriteTextureCache.forEach((t) => t.dispose());
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
