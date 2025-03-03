import { BoxGeometry, ColorRepresentation, DirectionalLight, EventDispatcher, GridHelper, Group, Mesh, MeshPhongMaterial, Object3D, Object3DEventMap, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import EditorControls from './EditorControls';
import { throttle } from './utils';

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
CAMERA_DEFAULT.position.set(5, 5, 10);
CAMERA_DEFAULT.lookAt(new Vector3());

type EditorEventMap = {
    rendered: { frametime: number };
    objectadded: {};
    objectremoved: {};
    geometrychanged: {};
};

export default class Editor extends EventDispatcher<EditorEventMap> {
    renderer: WebGLRenderer;
    scene: Scene;
    animations: FrameRequestCallback[] = [];
    camera: PerspectiveCamera;
    grid: Group<Object3DEventMap>;
    pid: number = -1;
    controls: EditorControls;
    $stats: HTMLElement;

    overlays: Object3D[] = [];

    get theme(): ColorScheme { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; };

    constructor(root: HTMLElement) {
        super();
        this.tick = this.tick.bind(this);
        this.render = this.render.bind(this);
        this.handleWindowResize = this.handleWindowResize.bind(this);
        this.handleStatChanged = this.handleStatChanged.bind(this);
        this.handleRendered = this.handleRendered.bind(this);

        console.log(`js Editor will use color scheme %c${this.theme}`, 'font-weight: bold');
        console.log('Baz');

        const { width, height } = root.getBoundingClientRect();
        const renderer = this.renderer = new WebGLRenderer({ antialias: true })
        renderer.setSize(width, height);
        const colours = THEMES[this.theme];
        renderer.setClearColor(colours.background[0], colours.background[1]);

        const scene = this.scene = new Scene();
        const camera = this.camera = CAMERA_DEFAULT.clone();

        scene.add(camera);

        const grid = this.grid = new Group();
        // 1 tick every unit
        const grid1 = new GridHelper(30, 30);
        grid1.material.color.setHex(colours.grid[0]);
        grid1.material.vertexColors = false;
        grid.add(grid1);

        // 1 tick every 5 units
        const grid2 = new GridHelper(30, 6);
        grid2.material.color.setHex(colours.grid[1]);
        grid2.material.vertexColors = false;
        grid.add(grid2);

        this.overlays.push(grid);

        root.innerHTML = '';
        root.appendChild(this.renderer.domElement);

        // TODO: move to class?
        const $stats = this.$stats = document.createElement('div');
        $stats.classList.add('overlay', 'overlay-stats');
        $stats.innerHTML = `
        <span data-id="stat-objects">0</span><span>Objects</span>
        <span data-id="stat-vertices">0</span><span>Vertices</span>
        <span data-id="stat-triangles">0</span><span>Triangles</span>
        <span data-id="stat-rendertime">0.00</span><span>Render Time</span>
        `;
        root.appendChild($stats);

        this.controls = new EditorControls(camera, renderer.domElement);
        // Re-render if the user moves the camera
        this.controls.addEventListener('change', this.render);

        this.addEventListener('rendered', throttle(this.handleRendered, 100));
        this.addEventListener('objectadded', this.handleStatChanged);
        this.addEventListener('objectadded', this.handleStatChanged);
        this.addEventListener('geometrychanged', this.handleStatChanged);

        // Kick off a resize event right away to update the camera aspect ratio
        window.addEventListener('resize', this.handleWindowResize);
        window.dispatchEvent(new Event('resize'));

        // this.tick(0);
    }

    /** Callback for when a tracked statistic changed (objects, geometry, etc) */
    handleStatChanged() {
        let objects = 0, vertices = 0, triangles = 0;

        for (let i = 0, l = this.scene.children.length; i < l; i++) {
            const object = this.scene.children[i];

            object.traverseVisible(function (object) {
                objects++;

                // @ts-ignore
                if (object.isMesh || object.isPoints) {
                    // @ts-ignore
                    const geometry = object.geometry;
                    vertices += geometry.attributes.position.count;

                    // @ts-ignore
                    if (object.isMesh) {
                        if (geometry.index !== null)
                            triangles += geometry.index.count / 3;
                        else
                            triangles += geometry.attributes.position.count / 3;
                    }
                }
            });
        }

        this.$stats.querySelector('[data-id="stat-objects"')!.textContent = objects.toFixed(0);
        this.$stats.querySelector('[data-id="stat-vertices"')!.textContent = vertices.toFixed(0);
        this.$stats.querySelector('[data-id="stat-triangles"')!.textContent = triangles.toFixed(0);
    }

    /** Callback for when the scene was rendered */
    handleRendered({ frametime }: EditorEventMap['rendered']) {
        const $rendertime = this.$stats.querySelector<HTMLElement>('[data-id="stat-rendertime"]')!;
        $rendertime.textContent = frametime.toFixed(2);
    }

    /** Callback for when the window is re-sized */
    handleWindowResize(event: UIEvent) {
        const aspect = this.renderer.domElement.offsetWidth / this.renderer.domElement.offsetHeight;

        if (this.camera.isPerspectiveCamera)
            this.camera.aspect = aspect;

        this.camera.updateProjectionMatrix();
    }

    /** Resets the scene and adds a single cube mesh & directional light. */
    scaffold() {
        this.scene.clear();

        const boxGeometry = new BoxGeometry();
        const material = new MeshPhongMaterial({ color: 0xffffff });
        const cube = new Mesh(boxGeometry, material);
        cube.position.set(0, 0.5, 0);
        this.scene.add(cube);

        const light = new DirectionalLight(0xffffff);
        light.position.set(-10, 15, 50);
        this.scene.add(light);

        // 180 / 10 deg per second
        this.animations.push(delta => cube.rotation.y = delta / (180 * 10));
        this.render();

        this.dispatchEvent({ type: 'objectadded' });
    }

    /** Renders the scene */
    render() {
        const startTime = performance.now();
        this.renderer.render(this.scene, this.camera);
        const endTime = performance.now();

        this.renderer.autoClear = false;
        for (const overlay of this.overlays)
            this.renderer.render(overlay, this.camera);
        this.renderer.autoClear = true;

        this.dispatchEvent({ type: 'rendered', frametime: endTime - startTime });
    }

    /** Tick function for animations */
    tick(delta: DOMHighResTimeStamp) {
        this.pid = requestAnimationFrame(this.tick);

        if (!this.animations.length)
            return;

        this.animations.forEach(cb => cb(delta));

        this.render();
    }
}
