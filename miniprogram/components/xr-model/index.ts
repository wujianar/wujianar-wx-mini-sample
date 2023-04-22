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
            this.removeModel();
        }
    },
    methods: {
        handleReady: function (e: any) {
            // xr-frame场景实例
            this.scene = e.detail.value;
        },
        handleARReady: function () {
            // AR系统启动
            this.setData({ isARReady: true });
            this.triggerEvent('arReady', { value: true }, {});
        },
        handleTick: function () {
            this.search();
        },
        handleTrackerSwitch: function (e: any) {
            // 是否追踪到目标
            if (e.detail.value) {
                console.info('found');
            } else {
                console.info('lost');
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

             // 获取场景内容，并发到云识别服务
             // 如果是要获取相机内容，请查看xr-frame官方文档
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

                this.showModel(msg.data);
            }).catch(err => {
                console.warn(err);
            });
        },
        showModel: async function (data: any) {
            let brief: ModelSetting;
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

            if (!brief.modelUrl) {
                wx.showToast({ title: '模型地址错误', icon: 'error' });
                return;
            }

            wx.showToast({
                icon: 'none',
                title: '模型加载中...',
                duration: 2000,
            });

            try {
                // 加载资源
                const asset = this.scene.assets.getAssetWithState('gltf', data.uuid);
                if (asset.state == 0) {
                    this.scene.assets.loadAsset({ type: 'gltf', assetId: data.uuid, src: brief.modelUrl });
                }

                this.setData({
                    markerUrl: data.image,
                    assetId: data.uuid,
                    scale: brief.scale
                });

                wx.showToast({
                    icon: 'none',
                    title: '请将相机对着识别图',
                });
            } catch (e) {
                console.error(e);
                wx.showModal({
                    title: '提示',
                    content: '模型加载失败',
                    showCancel: false,
                });
            }
        },
        removeModel: function () {
            this.setData({ markerUrl: '', assetId: '' });
        },
    }
});