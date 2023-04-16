import WuJianAR from "../../libs/wujian-ar-1.0.2";

/**
 * 
 * 技术支持：无间AR
 * 官网: https://www.wujianar.com
 * 技术支持QQ群：722979533
 * 
 */

// 初始化WebAR
const wuJianAR = new WuJianAR(getApp().globalData.config);

Component({
    properties: {
        useSearch: {
            type: Boolean,
            value: false,
        }
    },
    observers: {
    },
    data: {
        isARReady: false,
        markerUrl: '',
        targetId: '',
        isSearching: false,
        lastSearchTime: 0,
    },
    lifetimes: {
        created() {
        },
        detached() {
            this.removeVideo();
        }
    },
    methods: {
        async handleReady(e: any) {
            this.scene = e.detail.value;
            this.shadowRoot = this.scene.getElementById('shadow-root');
            this.xrFrameSystem = wx.getXrFrameSystem();
        },
        handleARReady: function () {
            this.setData({ isARReady: true });
            this.triggerEvent('arReady', { value: true }, {});
        },
        handleTick: function () {
            this.search();
        },
        handleTrackerSwitch: function (e: any) {
            try {
                const video = this.scene.assets.getAsset('video-texture', this.data.targetId);
                // xr-frame问题：没有暂停
                e.detail.value ? video?.play() : video?.stop();
            } catch (e) {
                console.warn(e);
            }
        },
        search: function () {
            if (!this.properties.useSearch || !this.data.isARReady || this.data.isSearching) {
                return;
            }

            const ts = Date.now();
            if (ts - this.data.lastSearchTime < 1000) {
                return;
            }
            this.data.lastSearchTime = ts;

            const base64 = this.scene.share.captureToDataURL({ type: 'type', quality: 0.7 });
            wuJianAR.search({ image: base64.split('base64,').pop() }).then(msg => {
                console.info(msg);

                // code为200时识别到目标，非200时为未识别到目标
                if (msg.code !== 200) {
                    wx.showToast({ title: `未识别到目标`, icon: 'none', duration: 1000 });
                    return;
                }

                this.triggerEvent('searchSuccess', msg.data, {});
                wx.showToast({ title: `识别到目标：${msg.data.name}`, icon: 'none', duration: 1000 });

                // 本例的数据为：　{code: 200, data: {name: "视频", uuid: "b0f131e8818348eeb160e081a936c578", brief: "{"videoUrl":"https://wujianar-cdn.oss-cn-hangzhou.aliyuncs.com/ardemo/videos/2.mp4"}"}, image: "https://wjasset.oss-cn-hangzhou.aliyuncs.com/a98a405c28c144c0b43ac5ce4ed7db0c/b0f131e8818348eeb160e081a936c578.jpg", message: "succeed"}
                this.showVideo(msg.data);
            }).catch(err => {
                console.warn(err);
            });
        },
        showVideo: async function (data: any) {
            let brief: VideoSetting;
            try {
                brief = JSON.parse(data.brief);
            } catch (e) {
                console.error(e);
                wx.showModal({
                    title: '提示',
                    content: '解析关联数据错误',
                    showCancel: false,
                });
                return;
            }

            wx.showToast({
                icon: 'none',
                title: '视频加载中...',
                duration: 2000,
            });

            try {
                let asset = this.scene.assets.getAsset('video-texture', data.uuid);
                if (!asset) {
                    // xr-frame问题：随机加载失败
                    const v = await this.scene.assets.loadAsset({
                        type: 'video-texture', assetId: data.uuid, src: brief.videoUrl,
                        // xr-frame问题：没有audio，没有loop
                        options: { autoPlay: true, abortAudio: false, loop: true }
                    });
                    asset = v.value;
                }

                const el = this.scene.createElement(this.xrFrameSystem.XRMesh, { geometry: 'plane', uniforms: `u_baseColorMap:video-${data.uuid}` });
                el.setId(`video-${data.uuid}`);
                this.shadowRoot.addChild(el);

                const t = el.getComponent(this.xrFrameSystem.Transform);
                t.scale.setValue(1, 1, asset.height / asset.width);

                this.setData({
                    markerUrl: data.image,
                });

                wx.showToast({
                    icon: 'none',
                    title: '请将相机对着识别图',
                });
            } catch (e) {
                // xr-frame问题：播放视频随机失败
                console.error(e);
                wx.showModal({
                    title: '提示',
                    content: '视频播放失败',
                    showCancel: false,
                });
            }
        },
        removeVideo: function () {
            const el = this.scene.getElementById(`video-${this.data.targetId}`);
            if (el) {
                this.shadowRoot.removeChild(el);
                this.scene?.assets?.releaseAsset('video-texture', this.data.targetId);
            }
        },
    }
});