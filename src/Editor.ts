import * as THREE from 'three';
import Signal from './Signal';

export type EditorSignals = {
    // script
    editScript: Signal;
    // player
    startPlayer: Signal; stopPlayer: Signal;
    // xr
    enterXR: Signal; offerXR: Signal; leaveXR: Signal;
    // notifications
    editorCleared: Signal; savingStarted: Signal; savingFinished: Signal; transformModeChanged: Signal; snapChanged: Signal; spaceChanged: Signal; rendererCreated: Signal; rendererUpdated: Signal; rendererDetectKTX2Support: Signal; sceneBackgroundChanged: Signal; sceneEnvironmentChanged: Signal; sceneFogChanged: Signal; sceneFogSettingsChanged: Signal; sceneGraphChanged: Signal; sceneRendered: Signal; cameraChanged: Signal; cameraResetted: Signal; geometryChanged: Signal; objectSelected: Signal; objectFocused: Signal; objectAdded: Signal; objectChanged: Signal; objectRemoved: Signal; cameraAdded: Signal; cameraRemoved: Signal; helperAdded: Signal; helperRemoved: Signal; materialAdded: Signal; materialChanged: Signal; materialRemoved: Signal; scriptAdded: Signal; scriptChanged: Signal; scriptRemoved: Signal; windowResize: Signal; showGridChanged: Signal; showHelpersChanged: Signal; refreshSidebarObject3D: Signal; refreshSidebarEnvironment: Signal; historyChanged: Signal; viewportCameraChanged: Signal; viewportShadingChanged: Signal; intersectionsDetected: Signal;
};

export default class Editor {
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    animations: FrameRequestCallback[] = [];
    camera: THREE.PerspectiveCamera;
    signals: EditorSignals;

    get width() { return window.innerWidth - 20 * 2; };
    get height() { return window.innerHeight - 20; };

    constructor(root: HTMLElement) {
        console.log('Hello, TypeScript!');
        this.tick = this.tick.bind(this);

        this.signals = {

            // script

            editScript: new Signal(),

            // player

            startPlayer: new Signal(),
            stopPlayer: new Signal(),

            // xr

            enterXR: new Signal(),
            offerXR: new Signal(),
            leaveXR: new Signal(),

            // notifications

            editorCleared: new Signal(),

            savingStarted: new Signal(),
            savingFinished: new Signal(),

            transformModeChanged: new Signal(),
            snapChanged: new Signal(),
            spaceChanged: new Signal(),
            rendererCreated: new Signal(),
            rendererUpdated: new Signal(),
            rendererDetectKTX2Support: new Signal(),

            sceneBackgroundChanged: new Signal(),
            sceneEnvironmentChanged: new Signal(),
            sceneFogChanged: new Signal(),
            sceneFogSettingsChanged: new Signal(),
            sceneGraphChanged: new Signal(),
            sceneRendered: new Signal(),

            cameraChanged: new Signal(),
            cameraResetted: new Signal(),

            geometryChanged: new Signal(),

            objectSelected: new Signal(),
            objectFocused: new Signal(),

            objectAdded: new Signal(),
            objectChanged: new Signal(),
            objectRemoved: new Signal(),

            cameraAdded: new Signal(),
            cameraRemoved: new Signal(),

            helperAdded: new Signal(),
            helperRemoved: new Signal(),

            materialAdded: new Signal(),
            materialChanged: new Signal(),
            materialRemoved: new Signal(),

            scriptAdded: new Signal(),
            scriptChanged: new Signal(),
            scriptRemoved: new Signal(),

            windowResize: new Signal(),

            showGridChanged: new Signal(),
            showHelpersChanged: new Signal(),
            refreshSidebarObject3D: new Signal(),
            refreshSidebarEnvironment: new Signal(),
            historyChanged: new Signal(),

            viewportCameraChanged: new Signal(),
            viewportShadingChanged: new Signal(),

            intersectionsDetected: new Signal(),

        };

        const renderer = this.renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(this.width, this.height);
        renderer.setClearColor(0xdddddd, 1);

        const scene = this.scene = new THREE.Scene();
        const camera = this.camera = new THREE.PerspectiveCamera(70, this.width / this.height);
        camera.position.z = 50;
        scene.add(camera);

        root.innerHTML = '';
        root.appendChild(this.renderer.domElement);

        this.tick(0);
    }

    scaffold() {
        const boxGeometry = new THREE.BoxGeometry(10, 10, 10);
        const basicMaterial = new THREE.MeshBasicMaterial({ color: 0x0095dd });
        const cube = new THREE.Mesh(boxGeometry, basicMaterial);
        this.scene.add(cube);
        cube.rotation.set(0.4, 0.2, 0);

        const light = new THREE.PointLight(0xffffff);
        light.position.set(-10, 15, 50);
        this.scene.add(light);

        // 180 / 10 deg per second
        this.animations.push(delta => cube.rotation.y = delta / (180 * 10));
    }

    tick(delta: DOMHighResTimeStamp) {
        requestAnimationFrame(this.tick);

        this.animations.forEach(cb => cb(delta));

        this.renderer.render(this.scene, this.camera);
    }
}
