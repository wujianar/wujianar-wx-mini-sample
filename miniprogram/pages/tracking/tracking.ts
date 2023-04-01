import ThreeHelper from "../../libs/three-helper";
import WuJinaAR from "../../libs/wujian-ar-1.0.2";

/**
 * 
 * 技术支持：无间AR
 * 官网: https://www.wujianar.com
 * 技术支持QQ群：722979533
 * 
 */

// 初始化WebAR
const wuJinaAR = new WuJinaAR(getApp().globalData.config);
const threeHelper = new ThreeHelper();
wuJinaAR.setThreeHelper(threeHelper);

Page({
    data: {
        height: 500,
        isSearching: false,
        isShowBtnClose: false,
    },
    video: null,
    onLoad() {
        const sys = wx.getSystemInfoSync();
        this.setData({
            width: sys.windowWidth,
            height: sys.windowHeight,
        });

        // 识别请求成功后的回调
        wuJinaAR.on(WuJinaAR.EVENT_SEARCH, (msg: SearchResponse) => {
            console.info(msg);

            // code为200时识别到目标，非200时为未识别到目标
            if (msg.code !== 200) {
                wx.showToast({ title: `未识别到目标`, icon: 'none', duration: 1000 });
                return;
            }

            // 识别到目标后，停止识别
            this.stopSearch();
            wx.showToast({ title: `识别到目标：${msg.data.name}`, icon: 'none', duration: 1000 });

            // 加载踪踪数据
            // 如：{code: 200, data: {name: "恐龙", uuid: "3ba85677176f49569364d958f5014fa1", brief: "{"modelUrl":"https://wujianar-cdn.oss-cn-hangzhou.aliyuncs.com/ardemo/models/kl.gltf","scale":0.07}"}, message: "succeed"}
            wuJinaAR.loadTrackingTarget(msg.data).then(() => {
                wx.showToast({ title: '请将相机对着识别图' });
            }).catch((err: ErrorMessage) => {
                console.info(err);
                wx.showToast({ icon: 'error', title: err.message });
            });
        });
    },
    onReady() {
        if (!wuJinaAR.isSupportTracker()) {
            wx.showModal({ title: '你的微信不支持跟踪功能', showCancel: false });
            return;
        }

        // threejs使用的webgl canvas
        this.queryCanvas('#three').then((target: any) => {
            threeHelper.setCanvas(target);
        }).catch(err => {
            console.error(err);
            wx.showToast({ title: '未找到模型渲染的canvas', icon: 'error' });
            return;
        });

        // camera使用的webgl canvas
        this.queryCanvas('#camera').then((target: any) => {
            // 打开跟踪功能
            wuJinaAR.openTracker(target);
            this.bindEvent();

            // 开启云识别
            this.startSearch();
        }).catch(err => {
            console.error(err);
            wx.showToast({ title: '未找到相机渲染的canvas', icon: 'error' });
        });
    },
    onUnload() {
        this.video = null;
        wuJinaAR.dispose();
    },
    bindEvent() {
        // threejs 帧更新事件
        threeHelper.on(ThreeHelper.EVENT_TICK, (delta: number) => {
            // console.info(delta);
        });

        // 加载视频
        wuJinaAR.on(WuJinaAR.EVENT_VIDEO, (setting: VideoSetting) => {
            this.setData({ videoUrl: setting.videoUrl });
        });

        // 开启跟踪功能后的事件回调
        wuJinaAR.startTracking().then(() => {
            // 识别到目标
            wuJinaAR.on(WuJinaAR.EVENT_FOUND, (anchor) => {
                console.info('WebAR.EVENT_FOUND');
                threeHelper.setAnchorStatus(true);

                // @ts-ignore
                this.video?.play();
            });
            // 跟踪丢失
            wuJinaAR.on(WuJinaAR.EVENT_LOST, (anchor) => {
                console.info('WebAR.EVENT_LOST');
                threeHelper.setAnchorStatus(false);

                // @ts-ignore
                this.video?.pause();
            });
        }).catch(err => {
            console.error(err);
        });
    },
    // 关闭踪踪
    closeTracking() {
        wuJinaAR.reset();
        this.setData({
            isSearching: true,
            videoUrl: '',
        });
        this.startSearch();

        // @ts-ignore
        this.video?.stop();
        this.video = null;
    },

    // 开始识别
    startSearch() {
        wuJinaAR.startSearch();
        this.setData({
            isSearching: true,
            isShowBtnClose: false,
        });
    },
    // 停止识别
    stopSearch() {
        wuJinaAR.stopSearch();
        this.setData({
            isSearching: false,
            isShowBtnClose: true,
        });
    },
    // 视频加载成功，加入跟踪播放
    videoMeta: async function (e: any) {
        if (this.video) {
            return;
        }

        const { width, height } = e.detail;

        const video = await this.queryContext('#video');
        this.video = video;
        const canvas = await this.queryCanvas('#videoCanvas');
        wuJinaAR.setVideo({ video, width, height, canvas });
    },
    videoError(e: any) {
        console.error(e);
        wx.showToast({ icon: 'error', title: '视频播放失败' });
    },
    videoWaiting(e: any) {
        console.info(e);
        // wx.showToast({ icon: 'none', title: '视频缓冲，请等待' });
    },
    queryCanvas(target: string): Promise<any> {
        return new Promise((resolve, reject) => {
            wx.createSelectorQuery()
                .select(target)
                .node(res => {
                    if (res == null) {
                        return reject(`未找到${target}`);
                    }
                    return resolve(res.node);
                }).exec();
        });
    },
    queryContext(target: string): Promise<any> {
        return new Promise((resolve, reject) => {
            wx.createSelectorQuery()
                .select(target)
                .context(res => {
                    if (res == null) {
                        return reject(`未找到${target}`);
                    }
                    return resolve(res.context);
                }).exec();
        });
    },
});