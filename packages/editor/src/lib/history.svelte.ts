const MAX_HISTORY = 100;

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const aRec = a as Record<string, unknown>;
  const bRec = b as Record<string, unknown>;
  const aKeys = Object.keys(aRec);
  if (aKeys.length !== Object.keys(bRec).length) return false;
  for (const k of aKeys) {
    if (!deepEqual(aRec[k], bRec[k])) return false;
  }
  return true;
}

/** Snapshot-based undo/redo for a single logical "document" (e.g. one canvas). Callers
 *  snapshot state before an edit gesture starts (begin) and after it ends (commit); no-op
 *  gestures (before === after) are silently dropped instead of cluttering the stack. */
export class HistoryStack<T> {
  #undoStack = $state<T[]>([]);
  #redoStack = $state<T[]>([]);
  #pending: T | null = null;

  get canUndo(): boolean {
    return this.#undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.#redoStack.length > 0;
  }

  begin(snapshot: T): void {
    this.#pending = snapshot;
  }

  commit(current: T): void {
    if (this.#pending === null) return;
    const before = this.#pending;
    this.#pending = null;
    if (deepEqual(before, current)) return;
    this.#undoStack.push(before);
    if (this.#undoStack.length > MAX_HISTORY) this.#undoStack.shift();
    this.#redoStack = [];
  }

  undo(current: T): T | undefined {
    const prev = this.#undoStack.pop();
    if (prev === undefined) return undefined;
    this.#redoStack.push(current);
    return prev;
  }

  redo(current: T): T | undefined {
    const next = this.#redoStack.pop();
    if (next === undefined) return undefined;
    this.#undoStack.push(current);
    return next;
  }

  reset(): void {
    this.#undoStack = [];
    this.#redoStack = [];
    this.#pending = null;
  }
}
