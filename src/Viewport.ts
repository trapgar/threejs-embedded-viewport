import { BoxGeometry, Camera, ColorRepresentation, DirectionalLight, EventDispatcher, GridHelper, Group, Mesh, MeshPhongMaterial, Object3D, Object3DEventMap, ObjectLoader, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three';
import { TransformControls } from './old/TransformControls';
import { throttle } from './utils';
import ViewportControls from './ViewportControls';
import ViewportSelector from './ViewportSelector';

type ColorScheme = 'dark' | 'light';

type ViewportColorThemes = {
  [K in ColorScheme]: {
    background: [hex: ColorRepresentation, alpha: number];
    grid: [hex: number, alpha: number];
  };
};

const THEMES: ViewportColorThemes = {
  'dark': { background: [0x000000, 0], grid: [0x555555, 0x888888] },
  'light': { background: [0xaaaaaa, 1], grid: [0x999999, 0x777777] },
};

const CAMERA_DEFAULT = new PerspectiveCamera(50, 1, 0.01, 1000);
CAMERA_DEFAULT.name = 'Camera';
CAMERA_DEFAULT.position.set(5, 5, 10);
CAMERA_DEFAULT.lookAt(new Vector3());

type ViewportEventMap = {
  rendered: { frametime: number; };
  objectadded: { object: Object3D; };
  objectremoved: { object: Object3D; };
  geometrychanged: {};
  camerareset: { camera: Camera; };
  scenegraphchanged: {};
  objectselected: { selected?: Object3D; };
};

export default class Viewport extends EventDispatcher<ViewportEventMap> {
  $root: HTMLElement;
  renderer: WebGLRenderer;
  scene: Scene;
  animations: FrameRequestCallback[] = [];
  cameras: Dictionary<Camera> = {};
  camera: PerspectiveCamera;
  grid: Group<Object3DEventMap>;
  pid: number = -1;
  controls: ViewportControls;
  selector: ViewportSelector;
  $stats: HTMLElement;
  scripts: URL[] = [];
  geometries: Dictionary = {};
  materials: Dictionary = {};
  gizmo: TransformControls;

  overlays: Object3D[] = [];

  get theme(): ColorScheme { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; };

  constructor(root: HTMLElement) {
    super();
    this.tick = this.tick.bind(this);
    this.render = this.render.bind(this);
    this.handleWindowResize = this.handleWindowResize.bind(this);
    this.handleSceneGraphChanged = this.handleSceneGraphChanged.bind(this);
    this.handleStatChanged = this.handleStatChanged.bind(this);
    this.handleRendered = this.handleRendered.bind(this);

    console.log(`THREE.js Embedded Viewport will use color scheme %c${this.theme}`, 'font-weight: bold');

    this.$root = root;
    const renderer = this.renderer = new WebGLRenderer({ antialias: true });
    const colours = THEMES[this.theme];
    renderer.setClearColor(colours.background[0], colours.background[1]);

    root.innerHTML = '';
    root.appendChild(renderer.domElement);

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

    this.selector = new ViewportSelector({ camera, canvas: renderer.domElement, scene });
    this.selector.addEventListener('change', ({ selected }) => this.dispatchEvent({ type: 'objectselected', selected }));

    // Create gizmo 1st as it overrides the mousedown events
    // this.gizmo = new TransformControls({ dispatcher: this, camera, canvas: renderer.domElement });
    this.gizmo = new TransformControls(camera, renderer.domElement as any);
    // this.overlays.push(this.gizmo.overlay);
    // this.gizmo.addEventListener('change', this.render);
    this.overlays.push(this.gizmo.getHelper());
    this.selector.addEventListener('change', ({ selected }) => {
      this.gizmo.detach();

      if (selected)
        this.gizmo.attach(selected);

      this.render();
    });

    this.gizmo.addEventListener('mousedown', () => this.controls.enabled = false);
    this.gizmo.addEventListener('mouseup', () => this.controls.enabled = true);
    this.gizmo.addEventListener('change', this.render);

    this.controls = new ViewportControls({ camera, canvas: renderer.domElement });
    // Re-render if the user moves the camera
    this.controls.addEventListener('change', this.render);

    this.addEventListener('scenegraphchanged', this.handleSceneGraphChanged);
    this.addEventListener('rendered', throttle(this.handleRendered, 100));
    this.addEventListener('objectadded', this.handleStatChanged);
    this.addEventListener('objectadded', this.handleStatChanged);
    this.addEventListener('geometrychanged', this.handleStatChanged);

    // Kick off a resize event right away to update the camera aspect ratio
    window.addEventListener('resize', this.handleWindowResize);
    window.dispatchEvent(new Event('resize'));

    // this.tick(0);
  }

  handleSceneGraphChanged() {
    this.render();
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
  handleRendered({ frametime }: ViewportEventMap['rendered']) {
    const $rendertime = this.$stats.querySelector<HTMLElement>('[data-id="stat-rendertime"]')!;
    $rendertime.textContent = frametime.toFixed(2);
  }

  /** Callback for when the window is re-sized */
  handleWindowResize(event: UIEvent) {
    const { width, height } = this.$root.getBoundingClientRect();
    this.renderer.setSize(width, height);
    const aspect = this.renderer.domElement.offsetWidth / this.renderer.domElement.offsetHeight;

    if (this.camera.isPerspectiveCamera)
      this.camera.aspect = aspect;

    this.camera.updateProjectionMatrix();
    this.render();
  }

  async fromJson(json: any) {
    this.scene.clear();

    const loader = new ObjectLoader();
    const camera = await loader.parseAsync(json.camera);

    const existingUuid = this.camera.uuid;
    const incomingUuid = camera.uuid;

    // copy all properties, including uuid
    this.camera.copy(camera);
    this.camera.uuid = incomingUuid;

    // remove old entry [existingUuid, this.camera]
    delete this.cameras[existingUuid];
    // add new entry [incomingUuid, this.camera]
    this.cameras[incomingUuid] = this.camera;

    this.dispatchEvent({ type: 'camerareset', camera: this.camera });

    this.scripts = json.scripts;

    const scene: any = await loader.parseAsync(json.scene);

    this.scene.uuid = scene.uuid;
    this.scene.name = scene.name;

    this.scene.background = scene.background;
    this.scene.environment = scene.environment;
    this.scene.fog = scene.fog;
    this.scene.backgroundBlurriness = scene.backgroundBlurriness;
    this.scene.backgroundIntensity = scene.backgroundIntensity;

    this.scene.userData = JSON.parse(JSON.stringify(scene.userData));

    while (scene.children.length > 0)
      this.addObject(scene.children[0]);

    this.dispatchEvent({ type: 'scenegraphchanged' });
  }

  addObject(object: Object3D, parent?: any, index?: number) {
    object.traverse((child: any) => {
      if (child.geometry)
        this.geometries[child.geometry.uuid] = child.geometry;
      if (child.material)
        this.materials[child.material.uuid] = child.material;

      // this.addCamera(child);
      // this.addHelper(child);
    });

    if (!parent)
      this.scene.add(object);
    else {
      parent.children.splice(index, 0, object);
      object.parent = parent;
    }

    this.dispatchEvent({ type: 'objectadded', object });
    // this.dispatchEvent({ type: 'scenegraphchanged' });
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

    this.dispatchEvent({ type: 'objectadded', object: cube });
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
