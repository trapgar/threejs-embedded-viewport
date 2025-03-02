import { BoxGeometry, ColorRepresentation, EventDispatcher, GridHelper, Group, Mesh, MeshBasicMaterial, Object3D, Object3DEventMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import EditorControls from './EditorControls';

type ColorScheme = 'dark' | 'light';

type EditorColorThemes = {
    [K in ColorScheme]: {
        background: [hex: ColorRepresentation, alpha: number];
        grid: [hex: number, alpha: number];
    };
};

const THEMES: EditorColorThemes = {
    'dark': { background: [0x000000, 0], grid: [0x555555, 0x888888] },
    'light': { background: [0xaaaaaa, 1], grid: [0x999999, 0x777777] },
};

const CAMERA_DEFAULT = new PerspectiveCamera(50, 1, 0.01, 1000);
CAMERA_DEFAULT.name = 'Camera';
CAMERA_DEFAULT.position.set(0, 5, 10);
CAMERA_DEFAULT.lookAt(new Vector3());

export default class Editor extends EventDispatcher {
    renderer: WebGLRenderer;
    scene: Scene;
    animations: FrameRequestCallback[] = [];
    camera: PerspectiveCamera;
    grid: Group<Object3DEventMap>;
    pid: number = -1;
    controls: EditorControls;

    overlays: Object3D[] = [];

    get theme(): ColorScheme { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; };

    constructor(root: HTMLElement) {
        super();
        this.tick = this.tick.bind(this);
        this.render = this.render.bind(this);

        console.log(`js Editor will use color scheme %c${this.theme}`, 'font-weight: bold');
        console.log('Baz');

        const { width, height } = root.getBoundingClientRect();
        const renderer = this.renderer = new WebGLRenderer({ antialias: true })
        renderer.setSize(width, height);
        const colours = THEMES[this.theme];
        renderer.setClearColor(colours.background[0], colours.background[1]);

        const scene = this.scene = new Scene();
        const camera = this.camera = CAMERA_DEFAULT.clone();

        this.controls = new EditorControls(camera, renderer.domElement);
        this.controls.addEventListener('change', this.render);

        scene.add(camera);

        const grid = this.grid = new Group();
        // 1 tick every unit
        const grid1 = new GridHelper(100, 100);
        grid1.material.color.setHex(colours.grid[0]);
        grid1.material.vertexColors = false;
        grid.add(grid1);

        // 1 tick every 5 units
        const grid2 = new GridHelper(100, 20);
        grid2.material.color.setHex(colours.grid[1]);
        grid2.material.vertexColors = false;
        grid.add(grid2);

        this.overlays.push(grid);

        root.innerHTML = '';
        root.appendChild(this.renderer.domElement);

        // this.tick(0);
    }

    scaffold() {
        const boxGeometry = new BoxGeometry();
        const basicMaterial = new MeshBasicMaterial({ color: 0x0095dd });
        const cube = new Mesh(boxGeometry, basicMaterial);
        cube.position.set(0, 0.5, 0);
        this.scene.add(cube);

        // const light = new PointLight(0xffffff);
        // light.position.set(-10, 15, 50);
        // this.scene.add(light);

        // 180 / 10 deg per second
        this.animations.push(delta => cube.rotation.y = delta / (180 * 10));
        this.render();
    }

    startTime = 0;
    endTime = 0;

    render() {
        this.startTime = performance.now();
        this.renderer.render(this.scene, this.camera);
        this.endTime = performance.now();

        this.renderer.autoClear = false;
        for (const overlay of this.overlays)
            this.renderer.render(overlay, this.camera);
        this.renderer.autoClear = true;
    }

    tick(delta: DOMHighResTimeStamp) {
        this.pid = requestAnimationFrame(this.tick);

        this.animations.forEach(cb => cb(delta));

        this.renderer.render(this.scene, this.camera);
    }
}
