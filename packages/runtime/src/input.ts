const KEY_TURN_SPEED = 2.5; // rad/sec
const MOUSE_SENSITIVITY = 0.0025;

export interface InputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  turnRate: number; // rad/sec, from keys — scale by dt
  lookDelta: number; // radians this frame, from mouse — apply directly
}

/** Keyboard (WASD/arrows) + pointer-lock mouse look, scoped to one canvas.
 * start()/stop() so callers (export bootstrap, editor Play tab) can tear it down. */
export class InputController {
  private canvas: HTMLCanvasElement;
  private keys = new Set<string>();
  private mouseDX = 0;

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
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

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  start(): void {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("click", this.onClick);
  }

  stop(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("click", this.onClick);
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.keys.clear();
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

    return { forward, strafe, turnRate, lookDelta };
  }
}
