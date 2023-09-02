import { createScopedThreejs } from "./three";
import { registerGLTFLoader } from "./gltf-loader";
import { registerOrbitControl } from "./orbit-controls";

export default class ThreeHelper {
    // @ts-ignore
    private THREE: THREE;
    private camera!: THREE.Camera;
    private scene!: THREE.Scene;
    private renderer!: THREE.WebGLRenderer;
    private clock!: THREE.Clock;
    private mixers: any[] = [];
    private anchor!: THREE.Object3D;
    private texture!: THREE.Texture;
    private renderRequestID: number = 0;
    private canvas!: WechatMiniprogram.Canvas;

    private frameWidth: number = 512;
    private videoRenderId: number = -1;
    private interval: number = 30;
    private files: string[] = [];

    private events: Map<String, (data: any) => void> = new Map();
    public static EVENT_TICK: string = 'tick';
    public static EVENT_MODEL: string = 'model';

    constructor() {
    }

    /**
     * 设置模型及视频的webgl canvas
     * @param canvas
     */
    public setCanvas(canvas: WechatMiniprogram.Canvas) {
        this.canvas = canvas;
        this.THREE = createScopedThreejs(canvas);
        registerGLTFLoader(this.THREE);
        registerOrbitControl(this.THREE);

        this.scene = new this.THREE.Scene();
        this.scene.add(new this.THREE.AmbientLight(0xFFFFFF, 2));

        this.clock = new this.THREE.Clock();

        this.anchor = new this.THREE.Object3D();
        this.anchor.visible = true;
        this.anchor.matrixAutoUpdate = false;
        this.scene.add(this.anchor);

        this.camera = new this.THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 1000);
        this.initCamera();
        this.camera.matrixAutoUpdate = false;

        this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.setPixelRatio(wx.getSystemInfoSync().pixelRatio);

        this.render();
    }

    private initCamera() {
        this.camera.rotation.set(0, 0, 0);
        this.camera.position.set(0, 3, 10);
        this.camera.lookAt(new this.THREE.Vector3(0, 3, 0));
    }

    private render() {
        this.renderRequestID = this.canvas.requestAnimationFrame(() => {
            this.render();
        });

        this.renderer.autoClearColor = true;
        this.renderer.render(this.scene, this.camera);
        for (const mixer of this.mixers) {
            mixer.update(this.clock.getDelta());
        }

        if (this.texture) {
            this.texture.needsUpdate = true;
        }

        this.emit(ThreeHelper.EVENT_TICK, this.clock.getDelta());
    }

    public addOrbitControl() {
        this.camera.matrixAutoUpdate = true;
        const { OrbitControls } = registerOrbitControl(this.THREE);
        const control = new OrbitControls(this.camera, this.renderer.domElement);
        control.update();
    }

    public on(name: string, func: (delta: number) => void) {
        this.events.set(name, func);
    }

    public off(name: string) {
        this.events.delete(name);
    }

    public emit(name: string, delta: any) {
        setTimeout(() => {
            this.events.get(name)?.call(this, delta);
        }, 1);
    }

    public setAnchorStatus(bl: boolean) {
        if (this.anchor) {
            this.anchor.visible = bl;
        }
    }

    /**
     * 更新相机的transform
     * @param vkCamera 
     * @returns 
     */
    public updateCamera(vkCamera: WechatMiniprogram.VKCamera) {
        const m = vkCamera.viewMatrix;
        if (!m) {
            return;
        }

        try {
            this.camera.matrixWorldInverse.fromArray(m);
            this.camera.matrixWorld.getInverse(this.camera.matrixWorldInverse);

            const projectionMatrix = vkCamera.getProjectionMatrix(0.1, 1000);
            this.camera.projectionMatrix.fromArray(projectionMatrix);
            this.camera.projectionMatrixInverse.getInverse(this.camera.projectionMatrix);
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * 加载模型
     * @param setting 
     * @returns 
     */
    public loadModel(setting: ModelSetting): Promise<any> {
        return new Promise((resolve, reject) => {
            const loader = new this.THREE.GLTFLoader();
            loader.load(setting.modelUrl, (object: any) => {
                const model = object.scene;
                model.scale.setScalar(setting.scale);
                model.name = 'player';
                this.anchor.add(model);

                if (object.animations.length > 0) {
                    model.mixer = new this.THREE.AnimationMixer(model);
                    this.mixers.push(model.mixer);
                    model.mixer.clipAction(object.animations[0]).play();
                }

                // this.emit(ThreeHelper.EVENT_MODEL, model);
                resolve(model);
            }, () => {
            }, (err: any) => {
                reject(err);
            });
        });
    }

    private disposeModel() {
        try {
            const model = this.scene?.getObjectByName('player');
            if (model) {
                this.anchor.remove(model);
                if (this.mixers.length > 0) {
                    this.mixers.pop();
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * 加载视频
     * @param cfg 
     * @returns 
     */
    public loadVideo(cfg: VideoConfig) {
        cfg.canvas.width = this.frameWidth;
        cfg.canvas.height = Math.floor(cfg.height * (this.frameWidth / cfg.width));

        const platform = wx.getSystemInfoSync().platform;
        this.texture = platform == 'ios' ? new this.THREE.Texture() : new this.THREE.CanvasTexture(cfg.canvas);
        this.texture.minFilter = this.THREE.LinearFilter;
        this.texture.wrapS = this.THREE.ClampToEdgeWrapping;
        this.texture.wrapT = this.THREE.ClampToEdgeWrapping;

        const material = new this.THREE.MeshBasicMaterial({ side: this.THREE.FrontSide, map: this.texture });
        const plane = new this.THREE.Mesh(new this.THREE.PlaneGeometry(1, cfg.height / cfg.width), material);
        plane.rotation.x = -Math.PI / 2;
        plane.name = 'player';
        this.anchor.add(plane);

        const ctx = cfg.canvas.getContext('2d');
        const renderVideo = () => {
            try {
                // @ts-ignore
                ctx.drawImage(cfg.video, 0, 0, cfg.width, cfg.height, 0, 0, cfg.canvas.width, cfg.canvas.height);

                if (platform == 'ios') {
                    this.loadVideoIOS(cfg);
                }
            } catch (err) {
                console.error(err);
            }

            this.videoRenderId = setTimeout(() => {
                renderVideo();
            }, this.interval);
        };

        renderVideo();
    }

    private loadVideoIOS(cfg: VideoConfig) {
        const filePath = `${wx.env.USER_DATA_PATH}/marker-${Math.random().toString(16).substring(2)}.jpg`;
        const imgData = cfg.canvas.toDataURL('image/jpg', 0.7).split('base64,').pop() || '';

        const fs = wx.getFileSystemManager();
        const fd = fs.openSync({ filePath, flag: 'w' });
        fs.writeFileSync(filePath, imgData, 'base64');
        fs.closeSync({ fd });
        this.files.push(filePath);

        (new this.THREE.ImageLoader()).load(filePath, (img: any) => {
            try {
                if (this.texture) {
                    this.texture.image = img;
                    this.texture.needsUpdate = true;
                }

                if (this.files.length > 3) {
                    fs.unlinkSync(this.files.shift() || '');
                }
            } catch (e) {
                console.warn(e);
            }
        });
    }
    private disposeVideo() {
        try {
            this.disposeModel();

            clearTimeout(this.videoRenderId);

            if (this.texture) {
                this.texture.dispose();
                // @ts-ignore
                this.texture = null;
            }
        } catch (err) {
            console.error(err);
        }
    }

    public dispose() {
        this.reset();

        if (this.canvas) {
            this.canvas.cancelAnimationFrame(this.renderRequestID);
            // @ts-ignore
            this.canvas = null;
        }

        if (this.camera) {
            // @ts-ignore
            this.camera = null;
        }
        if (this.mixers) {
            this.mixers = [];
        }
        if (this.clock) {
            // @ts-ignore
            this.clock = null;
        }
        // this.scene.dispose();
        if (this.scene) {
            // @ts-ignore
            this.scene = null;
        }
        if (this.THREE) {
            this.THREE = null;
        }
    }

    public reset() {
        this.disposeModel();
        this.disposeVideo();

        // 恢复到初始化的设置
        this.initCamera();
    }
}