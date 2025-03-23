import { Camera, EventDispatcher, Matrix3, Sphere, Spherical, Vector2, Vector3 } from 'three';

enum MouseButton {
  Primary = 0,
  Secondary = 2,
}

enum MovementMode {
  Rotate,
  Zoom,
  Pan,
}

const normalMatrix = new Matrix3();

type ViewportControlsEventMap = {
  change: any;
  rotate: { delta: Vector3; };
  zoom: { delta: Vector3; };
  pan: { delta: Vector3; };
};

type ViewportControlsParams = {
  camera: Camera;
  canvas: HTMLCanvasElement;
};

export default class ViewportControls extends EventDispatcher<ViewportControlsEventMap> {
  camera: Camera;
  element: HTMLCanvasElement;
  pointer = new Vector2();
  pointerOld = new Vector2();
  movementMode = MovementMode.Pan;
  delta = new Vector3();
  vector = new Vector3();
  spherical = new Spherical();
  sphere = new Sphere();

  enabled: boolean = true;

  center = new Vector3();
  panSpeed = 0.001;
  zoomSpeed = 0.1;
  rotationSpeed = 0.005;

  constructor({ camera, canvas }: ViewportControlsParams) {
    super();
    this.camera = camera;
    this.element = canvas;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handleMouseWheel = this.handleMouseWheel.bind(this);

    this.element.addEventListener('pointerdown', this.handlePointerDown);
    this.element.addEventListener('wheel', this.handleMouseWheel);
    this.element.addEventListener('contextmenu', e => e.preventDefault());
  }

  handlePointerDown(event: PointerEvent) {
    if (!this.enabled)
      return;

    // Right+Click
    if (event.button === MouseButton.Primary)
      this.movementMode = MovementMode.Rotate;
    // Left+Click
    else if (event.button === MouseButton.Secondary)
      this.movementMode = MovementMode.Pan;
    // ???
    else
      return;

    this.element.ownerDocument.addEventListener('pointermove', this.handlePointerMove);
    this.element.ownerDocument.addEventListener('pointerup', this.handlePointerUp);

    this.pointerOld.set(event.clientX, event.clientY);
  }

  handleMouseWheel(event: WheelEvent) {
    event.preventDefault();

    this.zoom(this.delta.set(0, 0, event.deltaY > 0 ? 1 : - 1));
  }

  handlePointerMove(event: PointerEvent) {
    this.pointer.set(event.clientX, event.clientY);

    const movementX = this.pointer.x - this.pointerOld.x;
    const movementY = this.pointer.y - this.pointerOld.y;

    if (this.movementMode === MovementMode.Rotate)
      this.rotate(this.delta.set(-movementX, - movementY, 0));
    else if (this.movementMode === MovementMode.Zoom)
      this.zoom(this.delta.set(0, 0, movementY));
    else if (this.movementMode === MovementMode.Pan)
      this.pan(this.delta.set(-movementX, movementY, 0));

    this.pointerOld.set(event.clientX, event.clientY);
  }

  handlePointerUp(event: PointerEvent) {
    this.element.ownerDocument.removeEventListener('pointermove', this.handlePointerMove);
    this.element.ownerDocument.removeEventListener('pointerup', this.handlePointerUp);
  }

  rotate(delta: Vector3) {
    this.vector.copy(this.camera.position).sub(this.center);

    this.spherical.setFromVector3(this.vector);
    this.spherical.theta += delta.x * this.rotationSpeed;
    this.spherical.phi += delta.y * this.rotationSpeed;
    this.spherical.makeSafe();
    this.vector.setFromSpherical(this.spherical);
    this.camera.position.copy(this.center).add(this.vector);
    this.camera.lookAt(this.center);

    this.dispatchEvent({ type: 'rotate', delta });
    this.dispatchEvent({ type: 'change' });
  }

  zoom(delta: Vector3) {
    const distance = this.camera.position.distanceTo(this.center);

    delta.multiplyScalar(distance * this.zoomSpeed);

    if (delta.length() > distance)
      return;

    delta.applyMatrix3(normalMatrix.getNormalMatrix(this.camera.matrix));
    this.camera.position.add(delta);

    this.dispatchEvent({ type: 'zoom', delta });
    this.dispatchEvent({ type: 'change' });
  }

  pan(delta: Vector3) {
    const distance = this.camera.position.distanceTo(this.center);

    delta.multiplyScalar(distance * this.panSpeed);
    delta.applyMatrix3(normalMatrix.getNormalMatrix(this.camera.matrix));

    this.camera.position.add(delta);
    this.center.add(delta);

    this.dispatchEvent({ type: 'pan', delta });
    this.dispatchEvent({ type: 'change' });
  }
}
