const KEY_TURN_SPEED = 2.5; // rad/sec
const MOUSE_SENSITIVITY = 0.0025;

const SLOT_KEYS: Record<string, 1 | 2 | 3 | 4> = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 };

export interface InputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  turnRate: number; // rad/sec, from keys — scale by dt
  lookDelta: number; // radians this frame, from mouse — apply directly
  fire: boolean; // held state, like forward/strafe — cooldown gating happens in player.ts
  switchToSlot: 1 | 2 | 3 | 4 | null; // edge-triggered, drained once per poll()
}

/** Keyboard (WASD/arrows) + pointer-lock mouse look, scoped to one canvas.
 * start()/stop() so callers (export bootstrap, editor Play tab) can tear it down. */
export class InputController {
  private canvas: HTMLCanvasElement;
  private keys = new Set<string>();
  private mouseDX = 0;
  private firing = false;
  private pendingSlot: 1 | 2 | 3 | 4 | null = null;

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
    if (!e.repeat) {
      const slot = SLOT_KEYS[e.code];
      if (slot) this.pendingSlot = slot;
    }
  };
  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };
  private onMouseMove = (e: MouseEvent): void => {
    if (document.pointerLockElement === this.canvas) this.mouseDX += e.movementX;
  };
  private onClick = (): void => {
    if (document.pointerLockElement !== this.canvas) this.canvas.requestPointerLock();
  };
  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0 && document.pointerLockElement === this.canvas) this.firing = true;
  };
  private onMouseUp = (e: MouseEvent): void => {
    if (e.button === 0) this.firing = false;
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  start(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("click", this.onClick);
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
  }

  stop(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("click", this.onClick);
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.keys.clear();
    this.firing = false;
  }

  poll(): InputState {
    let forward = 0;
    let strafe = 0;
    let turnRate = 0;

    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) forward += 1;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) forward -= 1;
    if (this.keys.has("KeyD")) strafe += 1;
    if (this.keys.has("KeyA")) strafe -= 1;
    if (this.keys.has("ArrowLeft")) turnRate -= KEY_TURN_SPEED;
    if (this.keys.has("ArrowRight")) turnRate += KEY_TURN_SPEED;

    const lookDelta = this.mouseDX * MOUSE_SENSITIVITY;
    this.mouseDX = 0;

    const switchToSlot = this.pendingSlot;
    this.pendingSlot = null;

    return { forward, strafe, turnRate, lookDelta, fire: this.firing, switchToSlot };
  }
}
