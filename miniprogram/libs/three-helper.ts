import { createScopedThreejs } from "./three";
import { registerGLTFLoader } from "./gltf-loader";

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
    private plane!: THREE.Mesh;
    private canvas!: WechatMiniprogram.Canvas;

    private videoRate: number = 0.5625;
    private frameSize: TargetSize = { width: 512, height: 1080 * (512 / 1920) };
    private videoFrame!: Uint8Array;
    private offscreenCanvas!: WechatMiniprogram.OffscreenCanvas;
    private offscreenCtx!: WechatMiniprogram.RenderingContext;

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

        this.scene = new this.THREE.Scene();
        this.scene.add(new this.THREE.AmbientLight(0xFFFFFF, 2));

        this.clock = new this.THREE.Clock();

        this.anchor = new this.THREE.Object3D();
        this.anchor.visible = true;
        this.anchor.matrixAutoUpdate = false;
        this.scene.add(this.anchor);

        this.camera = new this.THREE.PerspectiveCamera(70, canvas.width / canvas.height, 0.1, 1000);
        this.camera.position.set(0, 3, 10);
        this.camera.lookAt(new this.THREE.Vector3(0, 3, 0));
        this.camera.matrixAutoUpdate = false;

        this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.setPixelRatio(wx.getSystemInfoSync().pixelRatio);

        this.render();
    }

    private render() {
        this.canvas.requestAnimationFrame(() => {
            this.render();
        });

        this.renderer.render(this.scene, this.camera);
        for (const mixer of this.mixers) {
            mixer.update(this.clock.getDelta());
        }

        if (this.texture) {
            this.texture.needsUpdate = true;
        }

        this.emit(ThreeHelper.EVENT_TICK, this.clock.getDelta());
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
        this.anchor.visible = bl;
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

                this.emit(ThreeHelper.EVENT_MODEL, model);
                resolve(true);
            }, () => {
            }, (err: any) => {
                reject(err);
            });
        });
    }

    private disposeModel() {
        try {
            const model = this.scene.getObjectByName('player');
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
        this.videoRate = cfg.height / cfg.width;
        this.frameSize.height = cfg.height * (this.frameSize.width / cfg.width);

        if (!this.offscreenCanvas) {
            this.offscreenCanvas = wx.createOffscreenCanvas({ type: '2d', width: cfg.width, height: cfg.height });
            this.offscreenCtx = this.offscreenCanvas.getContext('2d');
        }

        const render = () => {
            // @ts-ignore
            this.offscreenCanvas.requestAnimationFrame(() => {
                render();
            });

            try {
                // @ts-ignore
                this.offscreenCtx.drawImage(cfg.video, 0, 0, cfg.width, cfg.height, 0, 0, this.frameSize.width, this.frameSize.height);
                // @ts-ignore
                const imgData = this.offscreenCtx.getImageData(0, 0, this.frameSize.width, this.frameSize.height);
                const data = new Uint8Array(imgData.data);
                if (!this.videoFrame) {
                    this.videoFrame = new Uint8Array(data.length);
                    this.addPlane();
                }
                this.videoFrame.set(data);
            } catch (err) {
                console.error(err);
            }
        };

        render();
    }

    private disposeVideo() {
        try {
            this.disposeModel();

            if (this.offscreenCanvas) {
                // @ts-ignore
                this.offscreenCtx = null;
                // @ts-ignore
                this.offscreenCanvas = null;
            }

            if (this.texture) {
                this.texture.dispose();
                // @ts-ignore
                this.texture = null;
            }
            // @ts-ignore
            this.plane = null;
            // @ts-ignore
            this.videoFrame = null;
        } catch (err) {
            console.error(err);
        }
    }

    private addPlane() {
        try {
            this.texture = new this.THREE.DataTexture(this.videoFrame, this.frameSize.width, this.frameSize.height);
            this.texture.minFilter = this.THREE.LinearFilter;
            this.texture.wrapS = this.THREE.ClampToEdgeWrapping;
            this.texture.wrapT = this.THREE.ClampToEdgeWrapping;

            const geometry = new this.THREE.PlaneGeometry(1, this.videoRate);
            const material = new this.THREE.MeshBasicMaterial({ side: this.THREE.BackSide, map: this.texture });
            this.plane = new this.THREE.Mesh(geometry, material);

            this.plane.rotation.x = Math.PI / 2;
            this.plane.name = 'player';
            this.anchor.add(this.plane);

            this.emit(ThreeHelper.EVENT_MODEL, this.plane);
        } catch (err) {
            console.error(err);
        }
    }

    public dispose() {
        this.reset();

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
            this.scene.clear();
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
    }
}