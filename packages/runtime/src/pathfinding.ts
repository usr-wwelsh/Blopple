import type { MapData } from "@blopple/shared";
import { isSolid } from "./engine";

/** Cap on cells expanded per search — bounds worst-case cost on a large/unreachable
 * map instead of scanning the whole grid; a search that hits this just reports
 * unreachable and gets retried on the next recompute (see PATH_RECOMPUTE_MS). */
const MAX_EXPANSIONS = 2000;

const SQRT2 = Math.SQRT2;

/** Binary min-heap keyed on fScore, storing cell indices (y*width+x). Plain array-based
 * open list would be O(n) per pop; with hundreds of enemies potentially repathing per
 * frame-batch, the heap keeps each recompute close to O(expansions * log(expansions)). */
class MinHeap {
  private items: number[] = [];
  constructor(private fScore: Float64Array) {}

  get size(): number {
    return this.items.length;
  }

  push(index: number): void {
    this.items.push(index);
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.fScore[this.items[parent]] <= this.fScore[this.items[i]]) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      for (;;) {
        const left = 2 * i + 1;
        const right = 2 * i + 2;
        let smallest = i;
        if (left < n && this.fScore[this.items[left]] < this.fScore[this.items[smallest]]) smallest = left;
        if (right < n && this.fScore[this.items[right]] < this.fScore[this.items[smallest]]) smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

/** Octile distance: exact heuristic for 8-directional movement with unit orthogonal
 * cost and sqrt2 diagonal cost — admissible and consistent, so the heap never needs
 * re-opening closed nodes. */
function octile(dx: number, dy: number): number {
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  return adx + ady + (SQRT2 - 2) * Math.min(adx, ady);
}

/** Grid A* from (startX, startY) to (goalX, goalY), both in world/cell coordinates.
 * Returns a list of cell-center waypoints from just past the start to the goal cell
 * (empty if start and goal are the same cell), or null if no path exists or the search
 * gives up after MAX_EXPANSIONS. Diagonal steps are only allowed when both flanking
 * orthogonal cells are open, so the path never cuts a solid corner — matches the
 * per-axis wall slide enemies actually move with (tryMoveEnemy in enemies.ts). */
export function findPath(
  map: MapData,
  startX: number,
  startY: number,
  goalX: number,
  goalY: number,
): { x: number; y: number }[] | null {
  const sx = Math.floor(startX);
  const sy = Math.floor(startY);
  const gx = Math.floor(goalX);
  const gy = Math.floor(goalY);

  if (sx === gx && sy === gy) return [];
  if (isSolid(map, gx, gy)) return null;

  const width = map.width;
  const height = map.height;
  const cellCount = width * height;
  const startIndex = sy * width + sx;
  const goalIndex = gy * width + gx;

  const gScore = new Float64Array(cellCount).fill(Infinity);
  const fScore = new Float64Array(cellCount).fill(Infinity);
  const cameFrom = new Int32Array(cellCount).fill(-1);
  const closed = new Uint8Array(cellCount);

  gScore[startIndex] = 0;
  fScore[startIndex] = octile(gx - sx, gy - sy);

  const open = new MinHeap(fScore);
  open.push(startIndex);

  let expansions = 0;

  while (open.size > 0) {
    const current = open.pop();
    if (closed[current]) continue;
    if (current === goalIndex) return reconstructPath(cameFrom, current, width);

    closed[current] = 1;
    if (++expansions > MAX_EXPANSIONS) return null;

    const cx = current % width;
    const cy = (current - cx) / width;

    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (isSolid(map, nx, ny)) continue;
        if (dx !== 0 && dy !== 0) {
          // prevent cutting a diagonal through a solid corner
          if (isSolid(map, cx + dx, cy) || isSolid(map, cx, cy + dy)) continue;
        }

        const neighbor = ny * width + nx;
        if (closed[neighbor]) continue;

        const stepCost = dx !== 0 && dy !== 0 ? SQRT2 : 1;
        const tentativeG = gScore[current] + stepCost;
        if (tentativeG < gScore[neighbor]) {
          cameFrom[neighbor] = current;
          gScore[neighbor] = tentativeG;
          fScore[neighbor] = tentativeG + octile(gx - nx, gy - ny);
          open.push(neighbor);
        }
      }
    }
  }

  return null;
}

function reconstructPath(cameFrom: Int32Array, goal: number, width: number): { x: number; y: number }[] {
  const cells: number[] = [];
  let current = goal;
  while (current !== -1) {
    cells.push(current);
    current = cameFrom[current];
  }
  cells.reverse();
  // cells[0] is the start cell — the path we hand back starts after it
  return cells.slice(1).map((index) => {
    const x = index % width;
    const y = (index - x) / width;
    return { x: x + 0.5, y: y + 0.5 };
  });
}
