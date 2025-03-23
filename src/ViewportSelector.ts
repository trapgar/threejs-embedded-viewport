import { Camera, EventDispatcher, Object3D, Raycaster, Scene, Vector2 } from 'three';
import { getCoordinatesFromMouseEvent } from './utils';

type ViewportSelectorEventMap = {
  change: { selected?: Object3D; };
};

type ViewportSelectorParams = {
  camera: Camera;
  canvas: HTMLCanvasElement;
  scene: Scene;
};

export default class ViewportSelector extends EventDispatcher<ViewportSelectorEventMap> {
  element: HTMLCanvasElement;
  camera: Camera;
  scene: Scene;
  raycaster = new Raycaster();

  constructor({ camera, canvas, scene }: ViewportSelectorParams) {
    super();
    this.element = canvas;
    this.camera = camera;
    this.scene = scene;

    this.handleMouseDown = this.handleMouseDown.bind(this);

    this.element.addEventListener('mousedown', this.handleMouseDown);
  }

  handleMouseDown(event: MouseEvent) {
    const $el = this.element;

    if (event.target !== $el)
      return;

    const [xDown, yDown] = getCoordinatesFromMouseEvent($el, event);
    const down = new Vector2(xDown, yDown);

    const handleMouseUp = (event: MouseEvent) => {
      const [xUp, yUp] = getCoordinatesFromMouseEvent($el, event);
      const up = new Vector2(xUp, yUp);

      // Not a drag event
      if (down.distanceTo(up) === 0) {
        const mouse = new Vector2((up.x * 2) - 1, - (up.y * 2) + 1);

        this.raycaster.setFromCamera(mouse, this.camera);
        const intersecting = this.getIntersectingObjects();

        this.dispatchEvent({ type: 'change', selected: intersecting[0]?.object });
      }

      $el.removeEventListener('mouseup', handleMouseUp);
    };

    $el.addEventListener('mouseup', handleMouseUp);
  }

  getIntersectingObjects() {
    const objects: Object3D[] = [];

    this.scene.traverseVisible(function (child) {
      objects.push(child);
    });

    // this.helpers.traverseVisible(function (child) {
    //   if (child.name === 'picker')
    //     objects.push(child);
    // });

    return this.raycaster.intersectObjects(objects, false);
  }
}
