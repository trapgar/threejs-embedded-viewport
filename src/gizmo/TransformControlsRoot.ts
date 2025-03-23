// @ts-nocheck
import { Controls, Object3D } from 'three';

export default class TransformControlsRoot extends Object3D {
  controls: Controls<{}>;

  constructor(controls: Controls<{}>) {
    super();

    // this.isTransformControlsRoot = true;
    this.controls = controls;
  }

  // updateMatrixWorld updates key transformation variables
  updateMatrixWorld(force?: boolean) {
    const controls = this.controls;

    if (controls.object !== undefined) {
      controls.object.updateMatrixWorld();

      if (controls.object.parent === null) {
        console.error('TransformControls: The attached 3D object must be a part of the scene graph.');
      }
      else {
        controls.object.parent.matrixWorld.decompose(controls._parentPosition, controls._parentQuaternion, controls._parentScale);
      }

      controls.object.matrixWorld.decompose(controls.worldPosition, controls.worldQuaternion, controls._worldScale);
      controls._parentQuaternionInv.copy(controls._parentQuaternion).invert();
      controls._worldQuaternionInv.copy(controls.worldQuaternion).invert();
    }

    controls.camera.updateMatrixWorld();
    controls.camera.matrixWorld.decompose(controls.cameraPosition, controls.cameraQuaternion, controls._cameraScale);

    if (controls.camera.isOrthographicCamera) {
      controls.camera.getWorldDirection(controls.eye).negate();
    }
    else {
      controls.eye.copy(controls.cameraPosition).sub(controls.worldPosition).normalize();
    }

    super.updateMatrixWorld(force);
  }

  dispose() {
    // this.traverse(function (child) {
    //   if (child.geometry)
    //     child.geometry.dispose();
    //   if (child.material)
    //     child.material.dispose();
    // });
  }
}
