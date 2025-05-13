import WuJianAR from "../../libs/wujian-ar";

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
        assetId: '',
        videoHeight: 1,
        isLoaded: false,
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
                const video = this.scene.assets.getAsset('video-texture', this.data.assetId);
                // 在基础库`v2.33.0`及以上，提供了暂停/唤醒方法
                e.detail.value ? video?.resume() : video?.pause();
            } catch (e) {
                console.warn(e);
            }
        },
        search: async function () {
            if (!this.properties.useSearch || !this.data.isARReady || this.data.isSearching) {
                return;
            }

            const ts = Date.now();
            if (ts - this.data.lastSearchTime < 1000) {
                return;
            }
            this.data.lastSearchTime = ts;

            const base64 = await this.scene.share.captureToDataURL({ type: 'jpg', quality: 0.7 });
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

            this.setData({
                assetId: data.uuid,
                markerUrl: data.image,
                videoUrl: brief.videoUrl,
            });
            wx.showLoading({ title: '视频加载中' });
        },
        removeVideo: function () {
            this.setData({ markerUrl: '', assetId: '', isLoaded: false });
        },
        handleAssetsProgress: function (e: any) {
            console.info(e);
        },
        handleAssetsLoaded: function () {
            wx.hideLoading();

            const asset = this.scene.assets.getAsset('video-texture', this.data.assetId);
            if (!asset) {
                wx.showToast({
                    icon: 'error',
                    title: '视频播放失败',
                });
                console.warn('not found video');
                return;
            }

            this.setData({ videoHeight: asset.height / asset.width, isLoaded: true });
            this.scene.assets.getAsset('video-texture', this.data.assetId)?.play();
            wx.showToast({
                icon: 'none',
                title: '请将相机对着识别图',
            });
        }
    }
});