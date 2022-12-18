export default class WuJianAR {
    eventNameFound = 'addAnchors';
    eventNameUpdate = 'updateAnchors';
    eventNameLost = 'removeAnchors';
    eventNameCamera = 'camera';
    eventNameFrame = 'frame';
    eventNameResize = 'resize';
    eventNameSearch = 'search';

    events = new Map();

    config = { token: '', endpointUrl: '', interval: 1000 };
    useSearch = false;
    isSearching = false;
    lastSearchTime = 0;

    constructor(config, canvas) {
        this.config = config;

        this.width = canvas.width;
        this.height = canvas.height;
        this.gl = canvas.getContext('webgl');
    }

    isSupportV1() {
        return wx.isVKSupport('v1');
    }

    isSupportV2() {
        return wx.isVKSupport('v2');
    }

    isSupport() {
        return this.isSupportV1() || this.isSupportV2();
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

        this._program = this.gl.createProgram();
        this._program.gl = this.gl;
        this.gl.attachShader(this._program, vertShader);
        this.gl.attachShader(this._program, fragShader);
        this.gl.deleteShader(vertShader);
        this.gl.deleteShader(fragShader);
        this.gl.linkProgram(this._program);
        this.gl.useProgram(this._program);

        const uniformYTexture = this.gl.getUniformLocation(this._program, 'y_texture');
        this.gl.uniform1i(uniformYTexture, 5);
        const uniformUVTexture = this.gl.getUniformLocation(this._program, 'uv_texture');
        this.gl.uniform1i(uniformUVTexture, 6);

        this._dt = this.gl.getUniformLocation(this._program, 'displayTransform');
        this.gl.useProgram(currentProgram);
    }

    initVAO() {
        const ext = this.gl.getExtension('OES_vertex_array_object');

        const currentVAO = this.gl.getParameter(this.gl.VERTEX_ARRAY_BINDING);
        const vao = ext.createVertexArrayOES();

        ext.bindVertexArrayOES(vao);

        const posAttr = this.gl.getAttribLocation(this._program, 'a_position');
        const pos = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, pos);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(posAttr, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(posAttr);
        vao.posBuffer = pos;

        const texcoordAttr = this.gl.getAttribLocation(this._program, 'a_texCoord');
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
        const { yTexture, uvTexture } = frame.getCameraTexture(this.gl, 'yuv');
        const displayTransform = frame.getDisplayTransform();
        if (!yTexture || !uvTexture) {
            return;
        }

        const currentProgram = this.gl.getParameter(this.gl.CURRENT_PROGRAM);
        const currentTexture = this.gl.getParameter(this.gl.ACTIVE_TEXTURE);
        this.gl.useProgram(this._program);

        const posAttr = this.gl.getAttribLocation(this._program, 'a_position');
        const pos = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, pos);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([1, 1, -1, 1, 1, -1, -1, -1]), this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(posAttr, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(posAttr);

        const texcoordAttr = this.gl.getAttribLocation(this._program, 'a_texCoord');
        const texcoord = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, texcoord);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([1, 1, 0, 1, 1, 0, 0, 0]), this.gl.STATIC_DRAW);
        this.gl.vertexAttribPointer(texcoordAttr, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(texcoordAttr);

        this.gl.uniformMatrix3fv(this._dt, false, displayTransform);
        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);

        this.gl.activeTexture(this.gl.TEXTURE0 + 5);
        this.gl.bindTexture(this.gl.TEXTURE_2D, yTexture);

        this.gl.activeTexture(this.gl.TEXTURE0 + 6);
        this.gl.bindTexture(this.gl.TEXTURE_2D, uvTexture);

        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);

        this.gl.useProgram(currentProgram);
        this.gl.activeTexture(currentTexture);
    }

    on(name, func) {
        this.events.delete(name);
        this.events.set(name, func);
    }

    off(name) {
        this.events.delete(name);
    }

    emit(name, data) {
        const func = this.events.get(name);
        if (func) {
            func.call(this, data);
        }
    }

    initTracking() {
        this.initShader();
        this.initVAO();

        const isV2 = this.isSupportV2();
        this.session = wx.createVKSession({
            track: { plane: { mode: isV2 ? 3 : 1 }, marker: true },
            version: isV2 ? 'v2' : 'v1',
            gl: this.gl
        });
    }

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
                    this.emit(this.eventNameFound, anchors[0]);
                });
                this.session.on('updateAnchors', anchors => {
                    this.emit(this.eventNameUpdate, anchors[0]);
                });
                this.session.on('removeAnchors', anchors => {
                    this.emit(this.eventNameLost, anchors[0]);
                });

                const onFrame = (ts) => {
                    const frame = this.session.getVKFrame(this.width, this.height);
                    if (frame) {
                        this.emit(this.eventNameCamera, frame.camera);
                        this.render(frame);

                        if (this.useSearch && !this.isSearching) {
                            this.search(frame);
                        }
                    }

                    this.session.requestAnimationFrame(onFrame);
                };
                this.session.requestAnimationFrame(onFrame);

                return resolve();
            });
        });
    }

    resetTracking() {
        this.removeMarker();
    }

    stopTracking() {
        this.session.stop();
        this.removeMarker();
    }

    loadMarkerByUrl(url) {
        const filePath = `${wx.env.USER_DATA_PATH}/marker-ar.jpeg`;
        const add = () => {
            return this.addMarker(filePath);
        };

        return new Promise((resolve, reject) => {
            wx.downloadFile({
                url,
                success: (res) => {
                    wx.getFileSystemManager().saveFile({
                        filePath,
                        tempFilePath: res.tempFilePath,
                        success: () => resolve(add()),
                        fail: err => reject(err),
                    });
                },
                fail: (err) => reject(err),
            });
        });
    }

    loadMarkerBybase64(img) {
        const filePath = `${wx.env.USER_DATA_PATH}/marker-ar.jpeg`;
        wx.getFileSystemManager().writeFile({
            filePath,
            data: img,
            encoding: 'base64',
            success: (r) => {
                add();
            },
            fail: (err) => {
                wx.showModal({
                    title: JSON.stringify(err),
                    showCancel: false,
                });
            }
        });
        const add = () => {
            this.addMarker(filePath);
        };
    }

    addMarker(filePath) {
        if (this.markerId) {
            this.removeMarker();
        }

        this.markerId = this.session.addMarker(filePath);
        return this.markerId;
    }

    removeMarker() {
        if (this.markerId) {
            this.session.removeMarker(this.markerId);
            this.markerId = null;
        }
    }

    /**
     * 开始云识别
     */
    startSearch() {
        this.useSearch = true;
    }

    /**
     * 停止云识别
     */
    stopSearch() {
        this.useSearch = false;
    }

    capture(frame) {
        const width = 480;
        const height = 640;
        const buffer = frame.getCameraBuffer(width, height);

        const canvas = wx.createOffscreenCanvas({ type: '2d', width, height });
        let img = canvas.getContext('2d').createImageData(width, height);
        img.data.set(new Uint8ClampedArray(buffer));
        canvas.getContext('2d').putImageData(img, 0, 0);
        return canvas.toDataURL("image/jpeg", this.config.quality || 0.7).split(',').pop();
    }

    search(frame) {
        if (this.isSearching) {
            return;
        }

        const now = Date.now();
        if ((now - this.lastSearchTime) < this.config.interval) {
            return;
        }
        this.lastSearchTime = now;
        this.isSearching = true;

        let imageData = '';
        try {
            imageData = this.capture(frame);
        } catch (err) {
            console.info(err);
        }

        wx.request({
            url: `${this.config.endpoint}/search?track=1`,
            method: 'POST',
            data: {
                image: imageData,
            },
            header: {
                'Authorization': this.config.token,
                'content-type': 'application/json'
            },
            timeout: 2000,
            success: res => {
                console.info(res.data);
                if (res.data.code == 200) {
                    this.stopSearch();

                    const func = this.events.get(this.eventNameSearch);
                    if (func) {
                        func.call(this, res.data);
                    };
                }
                this.isSearching = false;
            },
            fail: err => {
                this.isSearching = false;
                console.error(err);
            },
        });
    }

    dispose() {
        this.stopSearch();
        this.stopTracking();
    }
}