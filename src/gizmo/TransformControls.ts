import { Camera, Controls, EventDispatcher, Object3D, Object3DEventMap } from 'three';
import TransformControlsGizmo from './TransformControlsGizmo';
import TransformControlsPlane from './TransformControlsPlane';
import TransformControlsRoot from './TransformControlsRoot';

type ObjectSelectedDispatcherEventMap = {
  objectselected: { selected?: Object3D<Object3DEventMap>; };
};

type TransformControlsEventMap = {
  change: {};
};

type TransformControlsParams = {
  camera: Camera;
  canvas: HTMLCanvasElement;
  dispatcher: EventDispatcher<ObjectSelectedDispatcherEventMap>;
};

export default class TransformControls extends Controls<TransformControlsEventMap> {
  root: TransformControlsRoot;
  gizmo: TransformControlsGizmo;
  plane: TransformControlsPlane;
  axis: undefined;

  get overlay() { return this.root; };

  constructor({ dispatcher, camera, canvas }: TransformControlsParams) {
    super(undefined as any, canvas);

    this.handleObjectSelected = this.handleObjectSelected.bind(this);

    const root = new TransformControlsRoot(this);
    this.root = root;
    this.root.visible = false;

    const gizmo = new TransformControlsGizmo();
    this.gizmo = gizmo;
    root.add(gizmo);

    const plane = new TransformControlsPlane();
    this.plane = plane;
    root.add(plane);

    dispatcher.addEventListener('objectselected', this.handleObjectSelected);
  }

  handleObjectSelected({ selected }: ObjectSelectedDispatcherEventMap['objectselected']) {
    if (selected === this.object)
      return;

    // @ts-ignore
    this.object = selected;

    if (selected === undefined)
      this.axis = undefined;

    const newVisible = !!selected;
    const oldVisible = this.root.visible;
    this.root.visible = newVisible;

    if (oldVisible != newVisible)
      this.dispatchEvent({ type: 'change' });
  }
}
