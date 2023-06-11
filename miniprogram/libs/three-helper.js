import { createScopedThreejs } from "./three";
import { registerGLTFLoader } from "./gltf-loader";
import { registerOrbitControl } from "./orbit-controls";
export default class ThreeHelper {
    constructor() {
        this.mixers = [];
        this.renderRequestID = 0;
        this.frameWidth = 512;
        this.videoRenderId = -1;
        this.interval = 30;
        this.files = [];
        this.events = new Map();
    }
    /**
     * 设置模型及视频的webgl canvas
     * @param canvas
     */
    setCanvas(canvas) {
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
        this.camera.position.set(0, 3, 10);
        this.camera.lookAt(new this.THREE.Vector3(0, 3, 0));
        this.camera.matrixAutoUpdate = false;
        this.renderer = new this.THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(canvas.width, canvas.height);
        this.renderer.setPixelRatio(wx.getSystemInfoSync().pixelRatio);
        this.render();
    }
    render() {
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
    addOrbitControl() {
        this.camera.matrixAutoUpdate = true;
        const { OrbitControls } = registerOrbitControl(this.THREE);
        const control = new OrbitControls(this.camera, this.renderer.domElement);
        control.update();
    }
    on(name, func) {
        this.events.set(name, func);
    }
    off(name) {
        this.events.delete(name);
    }
    emit(name, delta) {
        setTimeout(() => {
            var _a;
            (_a = this.events.get(name)) === null || _a === void 0 ? void 0 : _a.call(this, delta);
        }, 1);
    }
    setAnchorStatus(bl) {
        if (this.anchor) {
            this.anchor.visible = bl;
        }
    }
    /**
     * 更新相机的transform
     * @param vkCamera
     * @returns
     */
    updateCamera(vkCamera) {
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
        }
        catch (err) {
            console.error(err);
        }
    }
    /**
     * 加载模型
     * @param setting
     * @returns
     */
    loadModel(setting) {
        return new Promise((resolve, reject) => {
            const loader = new this.THREE.GLTFLoader();
            loader.load(setting.modelUrl, (object) => {
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
            }, (err) => {
                reject(err);
            });
        });
    }
    disposeModel() {
        var _a;
        try {
            const model = (_a = this.scene) === null || _a === void 0 ? void 0 : _a.getObjectByName('player');
            if (model) {
                this.anchor.remove(model);
                if (this.mixers.length > 0) {
                    this.mixers.pop();
                }
            }
        }
        catch (err) {
            console.error(err);
        }
    }
    /**
     * 加载视频
     * @param cfg
     * @returns
     */
    loadVideo(cfg) {
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
            }
            catch (err) {
                console.error(err);
            }
            this.videoRenderId = setTimeout(() => {
                renderVideo();
            }, this.interval);
        };
        renderVideo();
    }
    loadVideoIOS(cfg) {
        const filePath = `${wx.env.USER_DATA_PATH}/marker-${Math.random().toString(16).substring(2)}.jpg`;
        const imgData = cfg.canvas.toDataURL('image/jpg', 0.7).split('base64,').pop() || '';
        const fs = wx.getFileSystemManager();
        const fd = fs.openSync({ filePath, flag: 'w' });
        fs.writeFileSync(filePath, imgData, 'base64');
        fs.closeSync({ fd });
        this.files.push(filePath);
        (new this.THREE.ImageLoader()).load(filePath, (img) => {
            try {
                if (this.texture) {
                    this.texture.image = img;
                    this.texture.needsUpdate = true;
                }
                if (this.files.length > 3) {
                    fs.unlinkSync(this.files.shift() || '');
                }
            }
            catch (e) {
                console.warn(e);
            }
        });
    }
    disposeVideo() {
        try {
            this.disposeModel();
            clearTimeout(this.videoRenderId);
            if (this.texture) {
                this.texture.dispose();
                // @ts-ignore
                this.texture = null;
            }
        }
        catch (err) {
            console.error(err);
        }
    }
    dispose() {
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
    reset() {
        this.disposeModel();
        this.disposeVideo();
    }
}
ThreeHelper.EVENT_TICK = 'tick';
ThreeHelper.EVENT_MODEL = 'model';
