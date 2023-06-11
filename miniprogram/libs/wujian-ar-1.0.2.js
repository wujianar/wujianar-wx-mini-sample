import { FormData } from "./form-data";
import upng from "./UPNG";
/**
 *
 * 技术支持：无间AR
 * 官网: https://www.wujianar.com
 * 技术支持QQ群：722979533
 *
 */
export default class WuJianAR {
    constructor(config) {
        this.searchFrom = 0;
        this.useSearch = false;
        this.isSearching = false;
        this.lastSearchTime = 0;
        this.width = 0;
        this.height = 0;
        this.markerId = -1;
        this.events = new Map();
        this.config = config;
    }
    version() {
        return '1.0.3';
    }
    on(name, func) {
        this.events.set(name, func);
    }
    off(name) {
        this.events.delete(name);
    }
    emit(name, msg) {
        setTimeout(() => {
            var _a;
            (_a = this.events.get(name)) === null || _a === void 0 ? void 0 : _a.call(this, msg);
        }, 1);
    }
    isSupportV1() {
        return wx.isVKSupport('v1');
    }
    isSupportV2() {
        return wx.isVKSupport('v2');
    }
    /**
     * 是否支持跟踪
     * @returns
     */
    isSupportTracker() {
        return this.isSupportV1() || this.isSupportV2();
    }
    /**
     * 打开跟踪器
     * @param canvas 相机画面webgl canvas
     * @returns
     */
    openTracker(canvas) {
        var _a;
        if (!this.isSupportTracker()) {
            return false;
        }
        this.searchFrom = WuJianAR.SEARCH_FROM_TRACKER;
        (_a = this.threeHelper) === null || _a === void 0 ? void 0 : _a.setAnchorStatus(false);
        this.width = canvas.width;
        this.height = canvas.height;
        this.gl = canvas.getContext('webgl');
        this.initShader();
        this.initVAO();
        const isV2 = this.isSupportV2();
        this.session = wx.createVKSession({
            track: { plane: { mode: isV2 ? 3 : 1 }, marker: true },
            version: isV2 ? 'v2' : 'v1',
            gl: this.gl
        });
        return true;
    }
    initShader() {
        const currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM);
        const vs = `
              attribute vec2 a_position;
              attribute vec2 a_texCoord;
              uniform mat3 displayTransform;
              varying vec2 v_texCoord;
              void main() {
                vec3 p = displayTransform * vec3(a_position, 0);
                gl_Position = vec4(p, 1);
                v_texCoord = a_texCoord;
              }
        `;
        const fs = `
              precision highp float;
      
              uniform sampler2D y_texture;
              uniform sampler2D uv_texture;
              varying vec2 v_texCoord;
              void main() {
                vec4 y_color = texture2D(y_texture, v_texCoord);
                vec4 uv_color = texture2D(uv_texture, v_texCoord);
      
                float Y, U, V;
                float R ,G, B;
                Y = y_color.r;
                U = uv_color.r - 0.5;
                V = uv_color.a - 0.5;
                
                R = Y + 1.402 * V;
                G = Y - 0.344 * U - 0.714 * V;
                B = Y + 1.772 * U;
                
                gl_FragColor = vec4(R, G, B, 1.0);
              }
        `;
        const vertShader = this.gl.createShader(this.gl.VERTEX_SHADER);
        this.gl.shaderSource(vertShader, vs);
        this.gl.compileShader(vertShader);
        const fragShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
        this.gl.shaderSource(fragShader, fs);
        this.gl.compileShader(fragShader);
        this.program = this.gl.createProgram();
        this.program.gl = this.gl;
        this.gl.attachShader(this.program, vertShader);
        this.gl.attachShader(this.program, fragShader);
        this.gl.deleteShader(vertShader);
        this.gl.deleteShader(fragShader);
        this.gl.linkProgram(this.program);
        this.gl.useProgram(this.program);
        const uniformYTexture = this.gl.getUniformLocation(this.program, 'y_texture');
        this.gl.uniform1i(uniformYTexture, 5);
        const uniformUVTexture = this.gl.getUniformLocation(this.program, 'uv_texture');
        this.gl.uniform1i(uniformUVTexture, 6);
        this.dt = this.gl.getUniformLocation(this.program, 'displayTransform');
        this.gl.useProgram(currentProgram);
    }
    initVAO() {
        const ext = this.gl.getExtension('OES_vertex_array_object');
        const currentVAO = this.gl.getParameter(this.gl.VERTEX_ARRAY_BINDING);
        const vao = ext.createVertexArrayOES();
        ext.bindVertexArrayOES(vao);
        const posAttr = this.gl.getAttribLocation(this.program, 'a_position');
        const pos = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, pos);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(posAttr, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(posAttr);
        vao.posBuffer = pos;
        const texcoordAttr = this.gl.getAttribLocation(this.program, 'a_texCoord');
        const texcoord = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texcoord);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([1, 1, 0, 1, 1, 0, 0, 0]), this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(texcoordAttr, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(texcoordAttr);
        vao.texcoordBuffer = texcoord;
        ext.bindVertexArrayOES(currentVAO);
    }
    render(frame) {
        this.gl.disable(this.gl.DEPTH_TEST);
        const { yTexture, uvTexture } = frame.getCameraTexture(this.gl);
        const displayTransform = frame.getDisplayTransform();
        if (!yTexture || !uvTexture) {
            return;
        }
        const currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM);
        const currentTexture = this.gl.getParameter(this.gl.ACTIVE_TEXTURE);
        this.gl.useProgram(this.program);
        const posAttr = this.gl.getAttribLocation(this.program, 'a_position');
        const pos = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, pos);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(posAttr, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(posAttr);
        const texcoordAttr = this.gl.getAttribLocation(this.program, 'a_texCoord');
        const texcoord = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texcoord);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([1, 1, 0, 1, 1, 0, 0, 0]), this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(texcoordAttr, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(texcoordAttr);
        this.gl.uniformMatrix3fv(this.dt, false, displayTransform);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
        this.gl.activeTexture(this.gl.TEXTURE0 + 5);
        this.gl.bindTexture(this.gl.TEXTURE_2D, yTexture);
        this.gl.activeTexture(this.gl.TEXTURE0 + 6);
        this.gl.bindTexture(this.gl.TEXTURE_2D, uvTexture);
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
        this.gl.useProgram(currentProgram);
        this.gl.activeTexture(currentTexture);
    }
    /**
     * 开启跟踪
     * @returns
     */
    startTracking() {
        return new Promise((resolve, reject) => {
            this.session.start(err => {
                if (err) {
                    console.error('VK error: ', err);
                    return reject(err);
                }
                this.session.on('resize', () => {
                    // todo
                    console.info('resize');
                });
                this.session.on('addAnchors', anchors => {
                    this.emit(WuJianAR.EVENT_FOUND, anchors[0]);
                });
                this.session.on('updateAnchors', anchors => {
                    this.emit(WuJianAR.EVENT_UPDATE, anchors[0]);
                });
                this.session.on('removeAnchors', anchors => {
                    this.emit(WuJianAR.EVENT_LOST, anchors[0]);
                });
                const onFrame = (ts) => {
                    const frame = this.session.getVKFrame(this.width, this.height);
                    if (frame) {
                        this.render(frame);
                        this.emit(WuJianAR.EVENT_CAMERA, frame.camera);
                        if (this.useSearch && !this.isSearching && (Date.now() - this.lastSearchTime) > this.config.interval) {
                            this.isSearching = true;
                            this.lastSearchTime = Date.now();
                            this.search({ image: this.captureVK() }).then((msg) => {
                                if (this.useSearch) {
                                    this.emit(WuJianAR.EVENT_SEARCH, msg);
                                }
                            }).catch(err => {
                                console.error(err);
                            });
                        }
                    }
                    else {
                        console.error('获取相机图像错误');
                    }
                    this.session.requestAnimationFrame(onFrame);
                };
                this.session.requestAnimationFrame(onFrame);
                return resolve(true);
            });
        });
    }
    /**
     * 重置跟踪
     */
    resetTracking() {
        this.removeMarker();
    }
    /**
     * 停止跟踪
     */
    stopTracking() {
        var _a;
        (_a = this.session) === null || _a === void 0 ? void 0 : _a.stop();
        this.removeMarker();
    }
    getFilePath() {
        return `${wx.env.USER_DATA_PATH}/marker-${Math.random().toString(16).substring(2)}.jpg`;
    }
    loadMarkerByUrl(url) {
        const filePath = this.getFilePath();
        return new Promise((resolve, reject) => {
            wx.downloadFile({
                url,
                success: (res) => {
                    wx.getFileSystemManager().saveFile({
                        filePath,
                        tempFilePath: res.tempFilePath,
                        success: () => resolve(this.addMarker(filePath)),
                        fail: err => reject(err),
                    });
                },
                fail: (err) => reject(err),
            });
        });
    }
    addMarker(filePath) {
        if (this.markerId != -1) {
            this.removeMarker();
        }
        this.markerId = this.session.addMarker(filePath);
        return this.markerId;
    }
    removeMarker() {
        var _a;
        if (!this.markerId || this.markerId == -1) {
            return;
        }
        (_a = this.session) === null || _a === void 0 ? void 0 : _a.removeMarker(this.markerId);
        this.markerId = -1;
    }
    /**
     * 开始识别
     */
    startSearch() {
        this.useSearch = true;
        this.isSearching = false;
        if (this.searchFrom !== WuJianAR.SEARCH_FROM_TRACKER) {
            this.startListener();
        }
    }
    /**
     * 停止识别
     */
    stopSearch() {
        var _a;
        this.useSearch = false;
        this.isSearching = false;
        if (this.searchFrom !== WuJianAR.SEARCH_FROM_TRACKER) {
            (_a = this.listener) === null || _a === void 0 ? void 0 : _a.stop();
        }
        // @ts-ignore
        this.listener = null;
    }
    startListener() {
        var _a, _b;
        if (this.listener) {
            (_a = this.listener) === null || _a === void 0 ? void 0 : _a.start();
            return;
        }
        this.listener = wx.createCameraContext().onCameraFrame(frame => {
            if (this.isSearching || (this.lastSearchTime + this.config.interval) > Date.now()) {
                return;
            }
            this.isSearching = true;
            this.lastSearchTime = Date.now();
            this.search({ image: this.captureCamera(frame) }).then((msg) => {
                if (this.useSearch) {
                    this.emit(WuJianAR.EVENT_SEARCH, msg);
                }
            }).catch(err => {
                console.error(err);
            });
        });
        (_b = this.listener) === null || _b === void 0 ? void 0 : _b.start();
    }
    captureCamera(frame) {
        const sys = wx.getSystemInfoSync();
        if (sys.platform == "android" && sys.version == "8.0.37") {
            const b = upng.encode([frame.data], frame.width, frame.height, 512);
            return wx.arrayBufferToBase64(b) || '';
        }
        return this.capture(frame);
    }
    capture(frame) {
        var _a;
        const width = 480;
        const height = 640;
        if (!this.canvas) {
            this.canvas = wx.createOffscreenCanvas({ type: '2d', width, height });
            this.ctx = this.canvas.getContext('2d');
        }
        const image = this.ctx.createImageData(width, height);
        // @ts-ignore
        image.data.set(new Uint8ClampedArray(frame.data || frame.getCameraBuffer(width, height)));
        this.ctx.putImageData(image, 0, 0);
        // @ts-ignore
        return (_a = this.canvas.toDataURL('image/jpeg', this.config.quantity || 0.7)) === null || _a === void 0 ? void 0 : _a.split(',').pop();
    }
    captureVK() {
        return this.gl.canvas.toDataURL('image/jpg', 0.7).split('base64,').pop() || '';
    }
    /**
     * base64图片数据识别
     * @param data
     * @returns
     */
    search(data) {
        return this.request({
            url: '',
            data: data,
            header: {
                'Authorization': this.config.token,
                'content-type': 'application/json'
            },
        });
    }
    /**
     * 拍照方式识别
     * @returns
     */
    searchByTakePhoto() {
        return new Promise((resolve, reject) => {
            wx.createCameraContext().takePhoto({
                quality: 'normal',
                success: (res) => {
                    wx.showToast({ title: 'success' });
                    this.searchByFile(res.tempImagePath).then(msg => {
                        this.emit(WuJianAR.EVENT_SEARCH, msg);
                    });
                    resolve(res.tempImagePath);
                },
                fail: err => {
                    wx.showToast({ title: 'error' });
                    reject(err);
                }
            });
        });
    }
    /**
     * 上传文件识别
     * @param filename
     * @returns
     */
    searchByFile(filename) {
        let data = null;
        try {
            const form = new FormData();
            form.appendFile('file', filename);
            data = form.getData();
        }
        catch (e) {
            wx.showToast({ title: 'error' });
        }
        return this.request({
            url: '',
            data: data.buffer,
            header: {
                'Authorization': this.config.token,
                'content-type': data.contentType
            },
        });
    }
    request(option) {
        return new Promise((resolve, reject) => {
            option.url = `${this.config.endpoint}/search?track=1`;
            option.method = 'POST';
            option.success = (res) => resolve(res.data);
            option.fail = (err) => reject(err);
            option.complete = () => { this.isSearching = false; };
            option.timeout = 60000;
            wx.request(option);
        });
    }
    setThreeHelper(t) {
        this.threeHelper = t;
        this.on(WuJianAR.EVENT_CAMERA, (camera) => {
            if (this.threeHelper && camera) {
                this.threeHelper.updateCamera(camera);
            }
        });
    }
    /**
     * 加载踪踪数据
     * @param msg
     * @returns
     */
    loadTrackingTarget(msg) {
        let setting = {};
        try {
            setting = JSON.parse(msg.brief);
        }
        catch (e) {
            return Promise.reject({ message: '关联信息格式错误', reason: e });
        }
        if (setting.modelUrl) {
            return this.loadModel(msg.image, setting);
        }
        if (setting.videoUrl) {
            return this.loadVideo(msg.image, setting);
        }
        return Promise.reject({ message: '关联信息错误', reason: null });
    }
    loadModel(trackImage, setting) {
        return new Promise((resolve, reject) => {
            this.threeHelper.loadModel(setting).then(() => {
                this.loadMarkerByUrl(trackImage).then(() => {
                    resolve(true);
                }).catch(err => {
                    reject({ message: '加载识别图错误', reason: err });
                });
            }).catch(err => {
                reject({ message: '模型加载错误', reason: err });
            });
        });
    }
    loadVideo(trackImage, setting) {
        this.emit(WuJianAR.EVENT_VIDEO, setting);
        return new Promise((resolve, reject) => {
            this.loadMarkerByUrl(trackImage).then(() => {
                resolve(true);
            }).catch(err => {
                reject({ message: '加载识别图错误', reason: err });
            });
        });
    }
    setVideo(cfg) {
        return this.threeHelper.loadVideo(cfg);
    }
    reset() {
        var _a;
        this.removeMarker();
        (_a = this.threeHelper) === null || _a === void 0 ? void 0 : _a.reset();
    }
    dispose() {
        this.stopSearch();
        this.stopTracking();
        if (this.dt) {
            this.dt = null;
        }
        if (this.program) {
            this.program = null;
        }
        if (this.gl) {
            this.gl = null;
        }
        if (this.session) {
            this.session.destroy();
        }
        if (this.ctx) {
            this.ctx = null;
        }
        if (this.canvas) {
            // @ts-ignore
            this.canvas = null;
        }
        if (this.threeHelper) {
            this.threeHelper.dispose();
            // @ts-ignore
            // this.threeHelper = null;
        }
    }
}
WuJianAR.SEARCH_FROM_CAMERA = 1;
WuJianAR.SEARCH_FROM_TRACKER = 2;
WuJianAR.EVENT_SEARCH = 'search';
WuJianAR.EVENT_FOUND = 'addAnchors';
WuJianAR.EVENT_UPDATE = 'updateAnchors';
WuJianAR.EVENT_LOST = 'removeAnchors';
WuJianAR.EVENT_CAMERA = 'camera';
WuJianAR.EVENT_FRAME = 'frame';
WuJianAR.EVENT_RESIXE = 'resize';
WuJianAR.EVENT_VIDEO = 'video';
